const express = require("express");
const cors = require("cors");
const puppeteer = require("puppeteer");
const bodyParser = require("body-parser");
const fs = require("fs");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const DATA_FILE = "linkedin_data.json";

const LINKEDIN_EMAIL = process.env.LINKEDIN_EMAIL;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function loginToLinkedIn(page) {
    try {
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
        
        // Wait for and fill in the email field
        await page.waitForSelector('#username');
        await page.type('#username', LINKEDIN_EMAIL);
        
        // Wait for and fill in the password field
        await page.waitForSelector('#password');
        await page.type('#password', LINKEDIN_PASSWORD);
        
        // Click the login button
        await page.click('button[type="submit"]');
        
        console.log("Waiting 15 seconds for phone verification... Please check your phone and click 'Yes, it's me'");
        
        // Increased delay to give more time for verification
        await delay(15000);
        
        // Check current URL to determine login status
        const currentUrl = await page.url();
        
        // If still on login page, wait a bit longer
        if (currentUrl.includes('login') || currentUrl.includes('checkpoint')) {
            console.log("Still waiting for verification...");
            await delay(10000);
        }
        
        // Final check
        const finalUrl = await page.url();
        if (finalUrl.includes('login') || finalUrl.includes('checkpoint')) {
            throw new Error('Login verification timeout - please try again');
        }
        
        // Wait for the feed to load
        try {
            await page.waitForSelector('.feed-identity-module', { timeout: 5000 });
        } catch (e) {
            // If feed selector isn't found, that's okay - might be a different page
            console.log("Continuing without feed verification...");
        }
        
        console.log("Login successful!");
    } catch (error) {
        console.error('Login failed:', error);
        throw error;
    }
}

app.post("/api/crawl", async (req, res) => {
    const { url } = req.body;
    let browser;

    if (!url || !url.includes("linkedin.com")) {
        return res.status(400).send({ error: "Invalid LinkedIn URL" });
    }

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
        const page = await browser.newPage();

        // Enhanced anti-detection measures
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36"
        );
        await page.setViewport({ width: 1280, height: 800 });

        // Add random delay to mimic human behavior
        await page.setDefaultNavigationTimeout(90000); // Increased timeout
        await page.setDefaultTimeout(30000);

        // Login first
        await loginToLinkedIn(page);

        // Add a small delay before accessing the profile
        await delay(Math.random() * 3000 + 2000);

        // Navigate to the profile URL
        await page.goto(url, { 
            waitUntil: "networkidle2",
            timeout: 60000 
        });

        // Wait for content to load with better error handling
        const selectors = {
            name: "h1.text-heading-xlarge",
            jobTitle: "div.text-body-medium",
            location: "span.text-body-small",
            summary: "section.pv-about-section"
        };

        const profileData = {};

        for (const [key, selector] of Object.entries(selectors)) {
            try {
                await page.waitForSelector(selector, { timeout: 30000 });
                profileData[key] = await page.$eval(selector, el => el.textContent.trim());
            } catch (error) {
                console.warn(`Failed to extract ${key}: ${error.message}`);
                profileData[key] = null;
            }
        }

        profileData.url = url;

        await browser.close();
        res.send(profileData);

    } catch (error) {
        console.error("Crawling failed:", error);
        if (browser) {
            await browser.close();
        }
        res.status(500).send({ 
            error: "Failed to crawl the LinkedIn page",
            details: error.message
        });
    }
});

// Start Server
app.listen(5000, () => console.log("Server running on http://localhost:5000"));