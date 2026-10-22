import "dotenv/config";
import express from "express";
import helmet from "helmet";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { z } from "zod";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);

const emailSchema = z
    .object({
        email: z.string().trim().email().max(254),
        subject: z
            .string()
            .trim()
            .min(1)
            .max(120)
            .refine((value) => !/[\r\n]/.test(value)),
        message: z.string().trim().min(1).max(5000),
    })
    .strict();

async function startServer() {
    const requiredSettings = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "MAIL_TO"];
    const missingSettings = requiredSettings.filter(
        (setting) => !process.env[setting]
    );

    if (missingSettings.length > 0) {
        throw new Error(
            `Missing required .env settings: ${missingSettings.join(", ")}`
        );
    }

    if (!z.string().email().safeParse(process.env.MAIL_TO).success) {
        throw new Error("MAIL_TO must be a valid email address.");
    }

    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecure = process.env.SMTP_SECURE === "true";

    if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
        throw new Error("SMTP_PORT must be a valid port number.");
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpSecure,
        requireTLS: !smtpSecure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    let redisClient;
    let rateLimitStore;

    if (process.env.REDIS_URL) {
        redisClient = createClient({ url: process.env.REDIS_URL });

        redisClient.on("error", (error) => {
            console.error("Redis connection error:", error.message);
        });

        await redisClient.connect();

        rateLimitStore = new RedisStore({
            prefix: "email-limit:",
            sendCommand: (...args) => redisClient.sendCommand(args),
        });
    } else if (process.env.NODE_ENV === "production") {
        throw new Error("REDIS_URL is required in production.");
    } else {
        console.warn(
            "Using in-memory rate limiting for development only. Configure Redis before production."
        );
    }

    const app = express();

    app.use(helmet());
    app.use(express.static(path.join(__dirname, "public")));

    const emailLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 3,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        ...(rateLimitStore ? { store: rateLimitStore } : {}),
        handler(_request, response) {
            response.status(429).json({
                error: "تم تجاوز الحد المسموح. حاول مرة أخرى بعد 15 دقيقة.",
            });
        },
    });

    app.post(
        "/api/email",
        emailLimiter,
        express.json({ limit: "10kb" }),
        async (request, response) => {
            const parsed = emailSchema.safeParse(request.body);

            if (!parsed.success) {
                return response.status(400).json({
                    error: "تحقق من عنوان الرسالة ونصها ثم حاول مجددًا.",
                });
            }

            try {
                await transporter.sendMail({
                    from: process.env.MAIL_FROM || process.env.SMTP_USER,
                    to: process.env.MAIL_TO,
                    replyTo: parsed.data.email,
                    subject: parsed.data.subject,
                    text: parsed.data.message,
                });

                return response.status(202).json({
                    message: "تم إرسال الرسالة.",
                });
            } catch (error) {
                const failures =
                    error instanceof AggregateError ? error.errors : [error];

                console.error("Email delivery failed:");

                for (const failure of failures) {
                    if (failure instanceof Error) {
                        const details = {
                            name: failure.name,
                            code:
                                "code" in failure
                                    ? failure.code
                                    : undefined,
                            command:
                                "command" in failure
                                    ? failure.command
                                    : undefined,
                            syscall:
                                "syscall" in failure
                                    ? failure.syscall
                                    : undefined,
                            address:
                                "address" in failure
                                    ? failure.address
                                    : undefined,
                            port:
                                "port" in failure ? failure.port : undefined,
                        };

                        console.error(details);
                    } else {
                        console.error("Unknown SMTP error");
                    }
                }

                return response.status(500).json({
                    error: "تعذر إرسال الرسالة الآن. حاول لاحقًا.",
                });
            }
        }
    );

    app.get("/", (_request, response) => {
        response.sendFile(path.join(__dirname, "public", "index.html"));
    });

    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}

startServer().catch((error) => {
    console.error("Server startup failed:", error.message);
    process.exitCode = 1;
});