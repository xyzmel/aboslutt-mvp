declare module "nodemailer" {
  type MailOptions = {
    to: string;
    from?: string;
    replyTo?: string;
    cc?: string;
    subject: string;
    text: string;
    html: string;
  };

  type Transport = {
    sendMail(options: MailOptions): Promise<{ messageId?: string | null }>;
  };

  const nodemailer: {
    createTransport(options: unknown): Transport;
  };

  export default nodemailer;
}
