type RemovalNotificationParams = {
  vin: string;
  auctionSource: string;
  lotNumber: string;
  paymentMethod: "Stripe" | "NOWPayments";
  amount: string;
  paymentId?: string | null;
};

export async function sendRemovalNotification({
  vin,
  auctionSource,
  lotNumber,
  paymentMethod,
  amount,
  paymentId,
}: RemovalNotificationParams) {
  const apiKey = process.env.RESEND_API_KEY;
  const notificationEmail =
    process.env.REMOVAL_NOTIFICATION_EMAIL;

  if (!apiKey || !notificationEmail) {
    console.error(
      "Removal notification email environment variables are missing."
    );
    return;
  }

  const listingUrl =
    `https://salvagevinhistory.com/lot/` +
    `${auctionSource.toLowerCase()}/${lotNumber}`;

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          "Salvage VIN History <notifications@salvagevinhistory.com>",

        to: [notificationEmail],

        subject:
          `Paid Removal Request — ${vin}`,

        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #171717;">
            <h2 style="margin-bottom: 20px;">
              New Paid Removal Request
            </h2>

            <p>
              A customer has successfully paid for an
              auction listing removal request.
            </p>

            <table
              cellpadding="8"
              cellspacing="0"
              style="border-collapse: collapse; margin: 20px 0;"
            >
              <tr>
                <td><strong>VIN</strong></td>
                <td>${vin}</td>
              </tr>

              <tr>
                <td><strong>Auction</strong></td>
                <td>${auctionSource}</td>
              </tr>

              <tr>
                <td><strong>Lot Number</strong></td>
                <td>${lotNumber}</td>
              </tr>

              <tr>
                <td><strong>Payment Method</strong></td>
                <td>${paymentMethod}</td>
              </tr>

              <tr>
                <td><strong>Amount</strong></td>
                <td>${amount}</td>
              </tr>

              ${
                paymentId
                  ? `
                    <tr>
                      <td><strong>Payment ID</strong></td>
                      <td>${paymentId}</td>
                    </tr>
                  `
                  : ""
              }
            </table>

            <p>
              <strong>Status:</strong> Pending review
            </p>

            <p>
              <a
                href="${listingUrl}"
                style="
                  display: inline-block;
                  padding: 12px 18px;
                  background: #171717;
                  color: #ffffff;
                  text-decoration: none;
                  border-radius: 6px;
                "
              >
                View Auction Listing
              </a>
            </p>

            <hr
              style="
                border: 0;
                border-top: 1px solid #dddddd;
                margin: 28px 0;
              "
            />

            <p style="font-size: 12px; color: #777777;">
              Salvage VIN History payment notification
            </p>
          </div>
        `,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "Resend notification failed:",
      response.status,
      errorText
    );

    return;
  }

  console.log(
    `Removal notification sent for ${vin} / ${auctionSource} / ${lotNumber}`
  );
}