module.exports = ({ env }) => ({
  serverKey: env("MIDTRANS_SERVER_KEY"),
  clientKey: env("MIDTRANS_CLIENT_KEY"),
});
