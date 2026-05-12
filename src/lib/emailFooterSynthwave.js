/**
 * Marketing iO Email Footer — uses hosted Cloudinary footer image + contact/legal text.
 */

const FOOTER_IMG_URL =
  'https://res.cloudinary.com/didwjb1et/image/upload/v1778534648/marketing_io_footer_clean_vkoqru.png';

export function emailFooterSynthwave({
  year = new Date().getFullYear(),
  footerImgUrl = FOOTER_IMG_URL,
  contactEmail = 'hello@marketingio.africa',
  contactPhone = '010 102 0534',
  websiteUrl = 'https://marketingio.africa',
  websiteLabel = 'marketingio.africa',
  address = '75 Marshall Street, Polokwane, 0699, South Africa',
  unsubscribeUrl = 'https://app.marketingio.africa/unsubscribe',
  privacyUrl = 'https://marketingio.africa/privacy',
  preferencesUrl = 'https://app.marketingio.africa/preferences',
} = {}) {
  const phoneHref = `tel:${contactPhone.replace(/\s+/g, '')}`;

  return `<!-- EMAIL FOOTER -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td align="center" style="padding:0;font-size:0;line-height:0;">
      <img src="${footerImgUrl}" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
    </td>
  </tr>
  <tr>
    <td align="center" style="background-color:#0a0a2e;padding:20px 24px 28px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
      <p style="margin:0 0 6px;color:#ffffff;font-size:13px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
        <a href="mailto:${contactEmail}" style="color:#ffffff;text-decoration:none;">${contactEmail}</a>
        &nbsp;&bull;&nbsp;
        <a href="${phoneHref}" style="color:#ffffff;text-decoration:none;">${contactPhone}</a>
        &nbsp;&bull;&nbsp;
        <a href="${websiteUrl}" style="color:#ffffff;text-decoration:none;">${websiteLabel}</a>
      </p>
      <p style="margin:0 0 16px;color:#ffffff;font-size:11px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">${address}</p>
      <p style="margin:0 0 6px;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.6;">© ${year} Marketing iO. All rights reserved.</p>
      <p style="margin:0;color:#ffffff;font-size:10px;font-family:Arial,Helvetica,sans-serif;opacity:0.7;">
        <a href="${unsubscribeUrl}" style="color:#ffffff;text-decoration:underline;">Unsubscribe</a>
        &nbsp;&bull;&nbsp;
        <a href="${privacyUrl}" style="color:#ffffff;text-decoration:underline;">Privacy Policy</a>
        &nbsp;&bull;&nbsp;
        <a href="${preferencesUrl}" style="color:#ffffff;text-decoration:underline;">Manage Preferences</a>
      </p>
    </td>
  </tr>
</table>
<!-- END EMAIL FOOTER -->`;
}

export default emailFooterSynthwave;