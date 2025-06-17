const twilio = require('twilio');
const dotenv = require('dotenv');
dotenv.config();

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);

/**
 * Send OTP to phone number
 * @param {string} phoneNumber - Phone number to send OTP to
 * @returns {Promise<Object>} - Twilio verification response
 */
exports.sendOTP = async (phoneNumber) => {
  try {
    const verification = await client.verify.v2.services(verifyServiceSid)
      .verifications
      .create({ to: phoneNumber, channel: 'sms' });

    console.log('✅ OTP sent successfully:', verification.status);
    return verification;
  } catch (error) {
    console.error('❌ Error sending OTP:', error.message);
    throw error;
  }
};

/**
 * Verify OTP code
 * @param {string} phoneNumber - Phone number to verify
 * @param {string} code - OTP code to verify
 * @returns {Promise<Object>} - Twilio verification check response
 */
exports.verifyOTP = async (phoneNumber, code) => {
  try {
    const verificationCheck = await client.verify.v2.services(verifyServiceSid)
      .verificationChecks
      .create({ to: phoneNumber, code });

    console.log('✅ OTP verification status:', verificationCheck.status);
    return verificationCheck;
  } catch (error) {
    console.error('❌ Error verifying OTP:', error.message);
    throw error;
  }
};