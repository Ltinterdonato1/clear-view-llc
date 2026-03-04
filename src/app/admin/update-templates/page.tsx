'use client';
import { db } from '../../../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';

export default function UpdateTemplates() {
  const [status, setStatus] = useState('');

  const update = async () => {
    setStatus('Updating...');
    try {
      const confirmationHtml = `
<!DOCTYPE html>
<html>
<body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #0f172a; background-color: #f1f5f9; margin: 0; padding: 40px 20px;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 32px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.1);">
        <div style="background: #0f172a; padding: 60px 40px; text-align: center;">
            <div style="display: inline-block; padding: 12px 24px; border: 1px solid #334155; border-radius: 100px; margin-bottom: 24px;">
                <span style="color: #38bdf8; font-size: 10px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase;">Reservation Confirmed</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 42px; font-weight: 900; letter-spacing: -2px; text-transform: uppercase; font-style: italic;">Clear View LLC</h1>
        </div>
        <div style="padding: 50px 40px;">
            <p style="font-size: 20px; line-height: 1.5; margin-bottom: 40px; color: #334155; font-weight: 300;">
                Hi <strong style="font-weight: 800; color: #0f172a;">{{firstName}}</strong>, your reservation is confirmed! Our Team will be at <span style="color: #0284c7; font-weight: 600;">{{fullAddress}}</span>. We will see you soon.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 40px; border-collapse: separate; border-spacing: 0 10px;">
                <tr>
                    <td style="background: #f8fafc; padding: 20px; border-radius: 16px 0 0 16px; border: 1px solid #e2e8f0; border-right: none;">
                        <span style="display: block; color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px;">Scheduled Date(s)</span>
                        <strong style="color: #0f172a; font-size: 16px;">{{{date}}}</strong>
                    </td>
                    <td style="background: #f8fafc; padding: 20px; border-radius: 0 16px 16px 0; border: 1px solid #e2e8f0; border-left: none;">
                        <span style="display: block; color: #94a3b8; text-transform: uppercase; font-size: 10px; font-weight: 800; letter-spacing: 2px; margin-bottom: 8px;">Arrival Window</span>
                        <strong style="color: #0284c7; font-size: 16px;">{{{time}}}</strong>
                    </td>
                </tr>
            </table>
            <div style="margin-bottom: 40px;">
                <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 3px; color: #94a3b8; margin-bottom: 20px; font-weight: 800; text-align: center;">Service Breakdown</h3>
                <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 20px; padding: 25px; font-size: 14px; font-weight: 500; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); white-space: pre-line; line-height: 1.8;">
{{serviceBreakdown}}
                </div>
            </div>
            <div style="background: #0f172a; border-radius: 24px; padding: 35px; color: #ffffff;">
                <table width="100%" style="border-collapse: collapse;">
                    <tr>
                        <td style="padding-bottom: 15px; color: #94a3b8; font-size: 13px;">Contract Subtotal</td>
                        <td style="padding-bottom: 15px; text-align: right; font-weight: 600;">\${{subtotal}}</td>
                    </tr>
                    {{#if hasDiscount}}
                    <tr>
                        <td style="padding-bottom: 15px; color: #10b981; font-size: 13px; font-weight: 700;">Multi-Service Savings</td>
                        <td style="padding-bottom: 15px; text-align: right; color: #10b981; font-weight: 700;">-\${{discountAmount}}</td>
                    </tr>
                    {{/if}}
                    <tr>
                        <td style="padding-top: 20px; border-top: 1px solid #1e293b; font-size: 16px; font-weight: 800;">Total Balance Due</td>
                        <td style="padding-top: 20px; border-top: 1px solid #1e293b; text-align: right; font-size: 28px; font-weight: 900; color: #38bdf8;">\${{balanceDue}}</td>
                    </tr>
                </table>
                <p style="margin: 20px 0 0; font-size: 11px; color: #475569; text-align: center; text-transform: uppercase; letter-spacing: 1px;">Due upon completion of service</p>
            </div>
        </div>
        <div style="background: #f8fafc; padding: 40px; border-top: 1px solid #f1f5f9;">
            <div style="text-align: center; margin-bottom: 30px;"><h4 style="margin: 0; text-transform: uppercase; font-size: 10px; letter-spacing: 4px; color: #94a3b8; font-weight: 800;">Preparation Guide</h4></div>
            <table width="100%" style="font-size: 13px; color: #475569; line-height: 1.8; margin-bottom: 30px;">
                <tr><td style="padding-bottom: 12px;">🔹 Ensure outdoor water spigots are accessible and turned ON.</td></tr>
                <tr><td style="padding-bottom: 12px;">🔹 Please provide 3ft of clearance around interior windows.</td></tr>
                <tr><td style="padding-bottom: 12px;">🔹 Secure all pets and move fragile items away from work areas.</td></tr>
                <tr><td style="padding-top: 10px;">⏰ <strong style="color: #0f172a;">Reminder:</strong> You will receive a text or email reminder within 24 hours before your service.</td></tr>
            </table>
            <div style="border-top: 1px solid #e2e8f0; text-align: center; padding-top: 30px;">
                <p style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 10px; text-transform: uppercase; font-style: italic;">Thank you for booking with us!</p>
                <p style="text-transform: uppercase; font-size: 10px; letter-spacing: 2px; color: #94a3b8; font-weight: 800; margin-bottom: 15px;">Clear View LLC</p>
                <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 5px;">📞 (206) 848-9325</p>
                <p style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 25px;">📧 clearview3cleaners@gmail.com</p>
            </div>
        </div>
    </div>
</body>
</html>`;

      await setDoc(doc(db, "email_templates", "confirmation"), {
        subject: "Reservation Confirmed - Clear View LLC",
        html: confirmationHtml
      }, { merge: true });

      await setDoc(doc(db, "email_templates", "invoice"), {
        subject: "Service Invoice - Clear View LLC",
        html: confirmationHtml.replace('Reservation Confirmed', 'Service Invoice')
      }, { merge: true });

      setStatus('Templates updated successfully! You can now delete this file.');
    } catch (e: any) {
      setStatus('Error: ' + e.message);
    }
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>Firebase Template Updater</h1>
      <button 
        onClick={update}
        style={{ padding: '20px 40px', fontSize: '20px', cursor: 'pointer', background: '#0f172a', color: 'white', borderRadius: '12px', border: 'none' }}
      >
        Push Updates to Firebase
      </button>
      <p style={{ marginTop: '20px', fontWeight: 'bold', color: status.includes('Error') ? 'red' : 'green' }}>{status}</p>
    </div>
  );
}
