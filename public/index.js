const emailForm = document.querySelector("#email-form");
const formStatus = document.querySelector("#form-status");
const submitButton = emailForm.querySelector('button[type="submit"]');

function showStatus(message, isError = false) {
    formStatus.textContent = message;
    formStatus.classList.add("is-visible");
    formStatus.classList.toggle("is-error", isError);
}

emailForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!emailForm.reportValidity()) {
        return;
    }

    submitButton.disabled = true;
    showStatus("جارٍ إرسال الرسالة...");

    try {
        const response = await fetch("/api/email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                email: document.querySelector("#email").value.trim(),
                subject: document.querySelector("#subject").value,
                message: document.querySelector("#message").value,
            }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok) {
            showStatus(
                result?.error || "تعذر إرسال الرسالة. حاول مرة أخرى.",
                true
            );
            return;
        }

        showStatus(result?.message || "تم إرسال الرسالة.");
        emailForm.reset();
    } catch (error) {
        showStatus(
            error instanceof Error
                ? error.message
                : "تعذر الاتصال بالخادم. حاول مرة أخرى.",
            true
        );
    } finally {
        submitButton.disabled = false;
    }
});