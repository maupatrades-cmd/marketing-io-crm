/**
 * Marketing iO Email Header — uses hosted Cloudinary header image.
 */

const HEADER_IMG_URL =
  'https://res.cloudinary.com/didwjb1et/image/upload/v1778534517/marketing_io_email_header_cropped_vbpoi5.png';

export function emailHeaderSynthwave({ headerImgUrl = HEADER_IMG_URL } = {}) {
  return `<!-- EMAIL HEADER -->
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;margin:0 auto;border-collapse:collapse;">
  <tr>
    <td align="center" style="padding:0;font-size:0;line-height:0;">
      <img src="${headerImgUrl}" width="600" alt="Marketing iO" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;"/>
    </td>
  </tr>
</table>
<!-- END EMAIL HEADER -->`;
}

export default emailHeaderSynthwave;