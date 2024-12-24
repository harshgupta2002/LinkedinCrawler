// React Component for Input Form
import React, { useState } from "react";

const LinkedInCrawler = () => {
  const [url, setUrl] = useState("");
  const [results, setResults] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const response = await fetch("http://localhost:5000/api/crawl", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });
    const data = await response.json();
    setResults(data);
  };

  return (
    <div>
      <h1>LinkedIn Crawler</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter LinkedIn URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit">Crawl</button>
      </form>
      <div>
        <h2>Results</h2>
        <pre>{JSON.stringify(results, null, 2)}</pre>
      </div>
    </div>
  );
};

export default LinkedInCrawler;
