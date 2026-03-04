const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * MASTER EMAIL DESIGNER
 * Generates professional HTML directly in the backend for 100% reliability.
 */
const generateEmailHtml = (type, data) => {
  const isInvoice = type === 'invoice';
  const title = isInvoice ? 'Service Invoice' : 'Reservation Confirmed';
  const intro = isInvoice 
    ? `Hi <strong>${data.firstName}</strong>, here is your service invoice for ${data.fullAddress}.`
    : `Hi <strong>${data.firstName}</strong>, your reservation is confirmed! Our Team will be at ${data.fullAddress}.`;
  
  const paymentButton = isInvoice && data.balanceDue !== '0.00' ? `
    <div style="margin-top: 30px; text-align: center;">
      <a href="${data.url || '#'}" 
         style="background-color: #0284c7; color: white; padding: 18px 40px; text-decoration: none; border-radius: 12px; font-weight: 800; text-transform: uppercase; font-size: 14px; display: inline-block;">
         Pay Invoice Securely
      </a>
    </div>` : '';

  return `
<!DOCTYPE html><html>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; background-color: #f1f5f9; margin: 0; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);">
        <div style="background: #0f172a; padding: 60px 40px; text-align: center;">
            <div style="display: inline-block; padding: 12px 24px; border: 1px solid #334155; border-radius: 100px; margin-bottom: 24px;">
                <span style="color: #38bdf8; font-size: 10px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">${title}</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 42px; font-weight: 900; letter-spacing: -2px; text-transform: uppercase; font-style: italic;">Clear View LLC</h1>
        </div>
        <div style="padding: 50px 40px;">
            <p style="font-size: 20px; line-height: 1.5; margin-bottom: 40px; color: #334155; font-weight: 300;">${intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 40px; border-collapse: separate; border-spacing: 0 10px;">
                <tr>
                    <td style="background: #f8fafc; padding: 20px; border-radius: 16px 0 0 16px; border: 1px solid #e2e8f0; border-right: none; width: 50%;">
                        <span style="display: block; color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px;">Scheduled Date(s)</span>
                        <strong style="color: #0f172a; font-size: 16px;">${data.date}</strong>
                    </td>
                    <td style="background: #f8fafc; padding: 20px; border-radius: 0 16px 16px 0; border: 1px solid #e2e8f0; border-left: none; width: 50%;">
                        <span style="display: block; color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px;">Arrival Window</span>
                        <strong style="color: #0284c7; font-size: 16px;">${data.time}</strong>
                    </td>
                </tr>
            </table>
            <div style="margin-bottom: 40px;">
                <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #94a3b8; margin-bottom: 20px; font-weight: 800; text-align: center;">Service Breakdown</h3>
                <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 20px; padding: 25px; font-size: 14px; font-weight: 500; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); white-space: pre-line; line-height: 1.8;">
${data.services}
                </div>
            </div>
            <div style="background: #0f172a; border-radius: 24px; padding: 35px; color: #ffffff;">
                <table width="100%" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding-top: 5px; font-size: 16px; font-weight: 800;">Total Balance Due</td>
                        <td style="padding-top: 5px; text-align: right; font-size: 28px; font-weight: 900; color: #38bdf8;">$${data.balanceDue}</td>
                    </tr>
                </table>
                ${paymentButton}
            </div>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-top: 1px solid #f1f5f9; text-align: center;">
            <p style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; font-style: italic;">Thank you for choosing us!</p>
            <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #94a3b8; font-weight: 800; margin-bottom: 15px;">Clear View LLC</p>
            <p style="font-size: 12px; font-weight: 700; color: #0f172a;">📞 (206) 848-9325</p>
        </div>
    </div>
</body></html>`;
};

// --- 1. Staff Management ---
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

// --- 2. SMS Logic ---
exports.sendSmsOnRequest = onDocumentCreated("sms_messages/{docId}", async (event) => {
  const data = event.data.data();
  let { to, body } = data;
  const linkMatch = body.match(/https?:\/\/[^\s]+/);
  const bookingLink = linkMatch ? linkMatch[0] : "";
  try {
    const response = await fetch("https://api.trillet.ai/v1/api/sms-booking-link/send-booking-link", {
      method: "POST", headers: { "x-api-key": "PASTE_YOUR_API_KEY_HERE", "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "698b58761abb672f59ba33f7", phone: to, bookingLink: bookingLink })
    });
    return event.data.ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) { return event.data.ref.update({ status: 'error', error: error.message }); }
});

// --- 3. MASTER EMAIL TRIGGER (Automated Receipts) ---
exports.handleLeadReceipts = onDocumentUpdated("leads/{leadId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const db = admin.firestore();
  const leadId = event.params.leadId;

  // Handle Auto-Receipt on Completion (Archived)
  // We use the 'leads' collection trigger by creating a Notification document
  if (before.status !== 'Archived' && after.status === 'Archived') {
    const email = after.email || after.customerEmail;
    if (email) {
      const { id, ...jobData } = after;
      await db.collection("leads").add({
        ...jobData,
        status: 'Notification',
        isNotification: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        email: email,
        to: [email],
        template: {
          name: 'invoice',
          data: {
            firstName: after.firstName || 'Customer',
            fullAddress: `${after.address}, ${after.city}`,
            balanceDue: '0.00',
            date: 'Service Completed',
            time: 'Paid in Full',
            services: after.selectedServices?.join(', ') || 'Services'
          }
        }
      });
    }
  }
});

// --- 4. Scheduled Reminders ---
exports.dispatchDailyReminders = onSchedule({ schedule: "0 8 * * *", timeZone: "America/Los_Angeles" }, async (event) => {
  const db = admin.firestore();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
  const snapshot = await db.collection("leads").where("status", "in", ["Scheduled", "scheduled"]).where("selectedDate", ">=", admin.firestore.Timestamp.fromDate(tomorrow)).get();
  snapshot.docs.forEach(async (doc) => {
    const job = doc.data();
    if (job.email) {
      await db.collection("leads").add({
        ...job,
        status: 'Notification',
        isNotification: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        to: [job.email],
        template: {
          name: 'confirmation',
          data: {
            firstName: job.firstName || 'Customer',
            fullAddress: `${job.address}, ${job.city}`,
            date: 'Service Tomorrow',
            time: job.timeSlot || 'Morning',
            services: job.selectedServices?.join(', ') || 'Services',
            balanceDue: job.total || '0.00'
          }
        }
      });
    }
  });
});
