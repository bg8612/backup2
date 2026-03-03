import { defineConfig } from "vite";
import { resolve } from "path";
import fileInclude from "vite-file-include";

export default defineConfig({
  base: "/",
  plugins: [fileInclude()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),

        catalog: resolve(__dirname, "pages/catalog.html"),
        products: resolve(__dirname, "pages/products.html"),
        payments: resolve(__dirname, "pages/payments.html"),
        profile: resolve(__dirname, "pages/profile.html"),
        register: resolve(__dirname, "pages/register.html"),
        authorization: resolve(__dirname, "pages/authorization.html"),
        productPage: resolve(__dirname, "pages/product-page.html"),
        successfulPayment: resolve(__dirname, "pages/successful-payment.html"),
        support: resolve(__dirname, "pages/support.html"),
        notFound: resolve(__dirname, "pages/404.html"),
      },
    },
  },
});
