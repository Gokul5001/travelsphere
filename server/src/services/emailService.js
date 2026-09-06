const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendWelcomeEmail(toEmail, fullName) {
  await sgMail.send({
    to: toEmail,
    from: process.env.EMAIL_FROM, // must exactly match your verified Single Sender
    subject: 'Welcome to TravelSphere ✈️',
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: auto; padding: 24px; background: #faf7f2; border-radius: 8px;">
        <h2 style="color: #1a2233;">Welcome to Travel<span style="color:#e05a2b;">Sphere</span>, ${fullName}!</h2>
        <p style="color: #555; line-height: 1.6;">
          Your account is ready. You can now search flights and hotels,
          save your travel documents, and check out in seconds.
        </p>
        <p style="color: #555; line-height: 1.6;">
          Safe travels,<br/>The TravelSphere Team
        </p>
      </div>
    `,
  });
}

module.exports = { sendWelcomeEmail };