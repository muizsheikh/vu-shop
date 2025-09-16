import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/app/"], // tumhari site ke hisab se adjust karo
      },
    ],
    sitemap: "https://vapeustad.com/sitemap.xml",
  };
}
