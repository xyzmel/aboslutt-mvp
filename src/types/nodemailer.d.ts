declare module "nodemailer" {
  type MailOptions = {
    to: string;
    from?: string;
    replyTo?: string;
    subject: string;
    text: string;
    html: string;
  };

  type Transport = {
    sendMail(options: MailOptions): Promise<unknown>;
  };

  const nodemailer: {
    createTransport(options: unknown): Transport;
  };

  export default nodemailer;
}
