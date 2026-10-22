## About the Project

**Secure Contact Form Mailer** is a secure backend system built with **Node.js**. It is specifically designed to protect contact forms on corporate, portfolio, and informational websites from spam, automated bots, and malicious flooding (DDoS attacks).

### Key Features & Security Mechanics:
*   **Anti-Spam & Hacker Blocking:** Dynamically filters spam messages and automatically blocks the IP addresses of attackers attempting to overload or crash the website's server.
*   **Strict Rate Limiting:** Enforces a rigid security rule allowing a **maximum of 3 emails every 15 minutes**.
*   **Anti-Bypass Protection:** Malicious users or bots cannot bypass the 15-minute cooldown by simply changing the input email address. The system tracks the sender's device footprint and IP to guarantee robust defense.
