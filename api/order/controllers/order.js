"use strict";

const { sanitizeEntity } = require("strapi-utils");
const axios = require("axios");
const midtransClient = require("midtrans-client");

const CITY_REGION_ID = "289";

const getArea = async (url, key, params) => {
  const requestURL = `https://api.rajaongkir.com/starter${url}`;
  const config = {
    headers: { key },
  };

  if (params) {
    config.params = params;
  }

  const res = await axios.get(requestURL, config);
  return res.data.rajaongkir.results;
};

const getOngkir = async (city, key) => {
  const res = await axios.post(
    `https://api.rajaongkir.com/starter/cost`,
    {
      origin: CITY_REGION_ID,
      destination: city,
      weight: 1000,
      courier: "jne",
    },
    {
      headers: { key },
    }
  );

  return res.data.rajaongkir.results;
};

function getRandomInt() {
  return Math.floor(Math.random() * (100000 - 1000) + 1000);
}

module.exports = {
  async token(ctx) {
    const { products, customer } = ctx.request.body;
    const productList = await strapi.services.product.find();
    let item_details = products.map((product) => {
      const item = productList.find((item) => item.id == product.id);
      return {
        id: product.id,
        quantity: product.quantity,
        name: `${item.name} (Size ${product.size})`,
        price: item.price,
      };
    });

    const shippingOption = await getOngkir(
      customer.city,
      strapi.config.get("ongkir.key")
    );
    const shipping = shippingOption[0].costs.find(
      (option) => option.service == customer.service
    );

    item_details.push({
      id: shipping.service,
      quantity: 1,
      name: `Shipping JNE (${shipping.service})`,
      price: shipping.cost[0].value,
    });

    const customer_details = {
      first_name: customer.first_name,
      last_name: customer.last_name,
      email: customer.email,
      phone: customer.phone,
    };

    const city = await getArea("/city", strapi.config.get("ongkir.key"), {
      id: customer.city,
    });

    const shipping_address = {
      ...customer_details,
      address: customer.address,
      city: city.city_name,
      postal_code: city.postal_code,
      country_code: "IDN",
    };

    const transaction_details = {
      order_id: getRandomInt(),
      gross_amount: item_details.reduce(
        (prev, curr) => curr.quantity * curr.price + prev,
        0
      ),
    };

    const parameter = {
      transaction_details,
      item_details,
      customer_details: {
        ...customer_details,
        shipping_address,
      },
    };

    let snap = new midtransClient.Snap({
      isProduction: false,
      serverKey: strapi.config.get("payment.serverKey"),
      clientKey: strapi.config.get("payment.clientKey"),
    });

    const token = await snap.createTransactionToken(JSON.stringify(parameter));

    ctx.body = { transaction_token: token };
  },

  async getProvince(ctx) {
    const res = await getArea(
      "/province",
      strapi.config.get("ongkir.key"),
      ctx.query
    );
    ctx.body = res;
  },

  async getCity(ctx) {
    const res = await getArea(
      "/city",
      strapi.config.get("ongkir.key"),
      ctx.query
    );
    ctx.body = res;
  },

  async getCost(ctx) {
    const { city } = ctx.params;

    if (!city) {
      ctx.throw(400, "City ID Required");
    }

    const res = await getOngkir(city, strapi.config.get("ongkir.key"));

    ctx.body = res;
  },

  async findOne(ctx) {
    const { order_id } = ctx.params;

    const entity = await strapi.services.order.findOne({ order_id });
    return sanitizeEntity(entity, { model: strapi.models.order });
  },
};
