const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const Stripe = require("stripe");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

// IMPORTANT: Add your Stripe Secret Key to Firebase Config:
// firebase functions:secrets:set STRIPE_SECRET_KEY=sk_test_...
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
});

// --- 1. Stripe Checkout Generation ---
exports.createStripeCheckout = onCall({ secrets: ["STRIPE_SECRET_KEY"] }, async (request) => {
  const data = request.data;
  const { leadId, customerEmail, customerName } = data;
  const amount = parseFloat(data.amount) || 0;

  if (amount <= 0) {
    throw new HttpsError("invalid-argument", "Amount must be greater than $0.");
  }

  const baseUrl = "https://clearview3cleaners.com"; // Updated to your GoDaddy domain

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Service for ${customerName || 'Valued Customer'}`,
              description: `Job Ref: ${leadId}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail,
      metadata: { leadId: leadId },
      success_url: `${baseUrl}/admin/payment-success?session_id={CHECKOUT_SESSION_ID}&leadId=${leadId}`,
      cancel_url: `${baseUrl}/admin/dashboard`,
    });

    return { url: session.url };
  } catch (error) {
    console.error("Stripe Error:", error);
    throw new HttpsError("internal", error.message);
  }
});

// --- 2. Staff Management ---
exports.createStaffAccount = onCall(async (request) => {
  const data = request.data;
  const cleanEmail = data.email.toLowerCase().trim();
  const existingDoc = await admin.firestore().collection("employees").doc(cleanEmail).get();
  if (existingDoc.exists) throw new HttpsError("already-exists", "Staff member exists.");

  const userRecord = await admin.auth().createUser({ email: cleanEmail, password: data.password, displayName: data.name });
  await admin.auth().setCustomUserClaims(userRecord.uid, { role: data.role });
  await admin.firestore().collection("employees").doc(cleanEmail).set({
    name: data.name, email: cleanEmail, phone: data.phone || '', homeBranch: data.homeBranch || 'Tri-Cities',
    hourlyRate: parseFloat(data.hourlyRate) || 0, uid: userRecord.uid, role: data.role, status: "clocked_out", createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { success: true };
});

// --- 3. SMS Logic ---
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

// --- 4. Automated Receipts ---
exports.handleLeadReceipts = onDocumentUpdated("leads/{leadId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const db = admin.firestore();

  if (before.status !== 'Archived' && after.status === 'Archived') {
    const email = after.email || after.customerEmail;
    if (email) {
      await db.collection("mail").add({
        to: [email],
        message: {
          subject: `Payment Receipt - Clear View LLC`,
          html: `<h2>Payment Received</h2><p>Hi ${after.firstName}, thank you for your payment of $${after.collectedAmount}!</p>`
        }
      });
    }
  }
});

// --- 5. Scheduled Reminders ---
exports.dispatchDailyReminders = onSchedule({ schedule: "0 8 * * *", timeZone: "America/Los_Angeles" }, async (event) => {
  const db = admin.firestore();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
  const snapshot = await db.collection("leads").where("status", "in", ["Scheduled", "scheduled"]).get();
  snapshot.docs.forEach(async (doc) => {
    const job = doc.data();
    if (job.email) {
      await db.collection("mail").add({
        to: [job.email],
        message: { subject: `Reminder: Service Tomorrow`, html: `<p>Reminder: Service at ${job.address} tomorrow.</p>` }
      });
    }
  });
});
