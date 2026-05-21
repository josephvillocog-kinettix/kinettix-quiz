import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON and form URLencoded
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Proxy 1: Fetch Users list
  app.get("/api/users", async (req, res) => {
    try {
      const usersGasUrl = "https://script.google.com/macros/s/AKfycbxkAYowCEAdiwFu-fNXSqHD7kdbIxNbW-AxT1i4Z0_-Hk0xfVpl7wySdgKPXYG9qIg00Q/exec";
      // Add secure browser User-Agent and cache buster
      const fetchUrl = `${usersGasUrl}?_cb=${Date.now()}`;
      const response = await fetch(fetchUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        redirect: "follow"
      });
      if (!response.ok) {
        throw new Error(`Google Apps Script returned status ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error proxying users GET:", error);
      res.status(500).json({ status: "error", message: error.message || "Failed to fetch users data" });
    }
  });

  // API Proxy 2: Fetch Quiz event questions (doGet)
  app.get("/api/quiz", async (req, res) => {
    try {
      const quizGasUrl = "https://script.google.com/macros/s/AKfycbwhc5FyhL9FpwYKZNOc1FieHL3X_A6sIZ-WwYQVeAVjjYD3ukpUKU9UkeI9ffSio8Sb8Q/exec";
      // Add secure browser User-Agent and cache buster to bypass caching on the Google Sheet
      const fetchUrl = `${quizGasUrl}?_cb=${Date.now()}`;
      const response = await fetch(fetchUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        redirect: "follow"
      });
      if (!response.ok) {
        throw new Error(`Google Apps Script returned status ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Error proxying quiz GET:", error);
      res.status(500).json({ status: "error", message: error.message || "Failed to fetch quiz questions" });
    }
  });

  // API Proxy 3: Submit winner (doPost)
  app.post("/api/quiz/submit", async (req, res) => {
    const { id, winner } = req.body;
    if (id === undefined || !winner) {
      return res.status(400).json({ status: "error", message: "Missing quiz 'id' or 'winner' name" });
    }

    try {
      const quizGasUrl = "https://script.google.com/macros/s/AKfycbwhc5FyhL9FpwYKZNOc1FieHL3X_A6sIZ-WwYQVeAVjjYD3ukpUKU9UkeI9ffSio8Sb8Q/exec";
      
      console.log(`Submitting winner to GAS with payload:`, { id, winner });

      const response = await fetch(quizGasUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: JSON.stringify({
          id: id,
          winner: winner,
        }),
        redirect: "follow",
      });

      const responseText = await response.text();
      console.log("GAS response text:", responseText);

      // Attempt to parse the GAS response text as JSON
      try {
        const jsonData = JSON.parse(responseText);
        res.json(jsonData);
      } catch {
        // If not JSON, return successful message with the raw string
        res.json({
          status: "success",
          message: "Submitted to Google Script",
          rawResponse: responseText,
        });
      }
    } catch (error: any) {
      console.error("Error proxying quiz submit POST:", error);
      res.status(500).json({ status: "error", message: error.message || "Failed to submit winner" });
    }
  });

  // Vite development middleware vs production static server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
