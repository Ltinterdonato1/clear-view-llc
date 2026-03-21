const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const Stripe = require("stripe");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Configure Mailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'clearview3cleaners@gmail.com',
    pass: 'mixjihjfnzdwfyev'
  }
});

/**
 * Sends email directly using Nodemailer
 */
async function sendMail(to, subject, text, html) {
  try {
    await transporter.sendMail({
      from: '"Clear View LLC" <clearview3cleaners@gmail.com>',
      replyTo: 'clearview3cleaners@gmail.com',
      to,
      subject,
      text,
      html
    });
    console.log(`Email successfully handed off to Gmail SMTP for: ${to}`);
  } catch (error) {
    console.error("Nodemailer Error:", error);
    throw new HttpsError("internal", error.message);
  }
}

// 1. Stripe Checkout
exports.createStripeCheckout = onCall({ secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-01-28.clover',
  });
  const { leadId, customerEmail, customerName, amount } = request.data;
  if (!amount || amount <= 0) throw new HttpsError("invalid-argument", "Invalid amount.");

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Service for ${customerName}`, description: `Job Ref: ${leadId}` },
          unit_amount: Math.round(amount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: customerEmail,
      metadata: { leadId },
      success_url: `https://clearview3cleaners.com/admin/payment-success?leadId=${leadId}`,
      cancel_url: `https://clearview3cleaners.com/admin/dashboard`,
    });
    return { url: session.url };
  } catch (error) { throw new HttpsError("internal", error.message); }
});

// 2. Staff Management
exports.createStaffAccount = onCall(async (request) => {
  const data = request.data;
  const userRecord = await admin.auth().createUser({ email: data.email, password: data.password, displayName: data.name });
  await admin.firestore().collection("employees").doc(data.email.toLowerCase()).set({ ...data, uid: userRecord.uid });
  return { success: true };
});

exports.updateStaffPassword = onCall(async (request) => {
  const { uid, newPassword } = request.data;
  try {
    await admin.auth().updateUser(uid, { password: newPassword });
    return { success: true };
  } catch (error) { throw new HttpsError("internal", error.message); }
});

// 3. SMS Logic
exports.sendSmsOnRequest = onDocumentCreated("sms_messages/{docId}", async (event) => {
  const data = event.data.data();
  let { to, body } = data;
  const linkMatch = body.match(/https?:\/\/[^\s]+/);
  const bookingLink = linkMatch ? linkMatch[0] : "";
  try {
    const response = await fetch("https://api.trillet.ai/v1/api/sms-booking-link/send-booking-link", {
      method: "POST", headers: { "x-key": "698b58761abb672f59ba33f7", "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "698b58761abb672f59ba33f7", phone: to, bookingLink: bookingLink })
    });
    return event.data.ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) { return event.data.ref.update({ status: 'error', error: error.message }); }
});

// 4. Automated Booking Confirmation
exports.onLeadCreated = onDocumentCreated("leads/{leadId}", async (event) => {
  const job = event.data.data();
  if (job.isNotification || !job.email || job.status === 'Archived') return;

  const html = `<!DOCTYPE html><html><body><h1>Reservation Confirmed</h1><p>Hi ${job.firstName}, your service at ${job.address} is confirmed for ${job.appointmentDate}.</p></body></html>`;
  await sendMail(job.email, "Reservation Confirmed - Clear View LLC", "Reservation Confirmed.", html);
});

// 5. Automated Payment Receipt
exports.handleLeadReceipts = onDocumentUpdated("leads/{leadId}", async (event) => {
  const after = event.data.after.data();
  if (event.data.before.data().status !== 'Archived' && after.status === 'Archived' && after.email) {
    await sendMail(after.email, "Payment Receipt", "Payment Received.", `<h2>Payment Received</h2><p>Thank you!</p>`);
  }
});

// 6. Manual Email Trigger (Bypasses Firestore Extension entirely)
exports.sendManualEmail = onCall(async (request) => {
  const { to, subject, text, html } = request.data;
  await sendMail(to, subject, text, html);
  return { success: true };
});

// 7. Scheduled Reminders
exports.dispatchDailyReminders = onSchedule({ schedule: "0 8 * * *", timeZone: "America/Los_Angeles" }, async (event) => {
  const db = admin.firestore();
  const snapshot = await db.collection("leads").where("status", "in", ["Scheduled", "scheduled"]).get();
  snapshot.docs.forEach(async (doc) => {
    const job = doc.data();
    if (job.email) {
      await sendMail(job.email, "Reminder: Service Tomorrow", "Reminder: You have a service scheduled for tomorrow.", `<p>Reminder: Service at ${job.address} tomorrow.</p>`);
    }
  });
});

// Final Exports for Firebase
exports.createStripeCheckout = exports.createStripeCheckout;
exports.createStaffAccount = exports.createStaffAccount;
exports.updateStaffPassword = exports.updateStaffPassword;
exports.sendSmsOnRequest = exports.sendSmsOnRequest;
exports.onLeadCreated = exports.onLeadCreated;
exports.handleLeadReceipts = exports.handleLeadReceipts;
exports.sendManualEmail = exports.sendManualEmail;
exports.dispatchDailyReminders = exports.dispatchDailyReminders;
