"use client";
import { useEffect, useState } from "react";
import { apiGet, apiPost } from "./api";

export default function Home() {
  const [engagements, setEngagements] = useState<any[]>([]);
  const [name, setName] = useState("Demo County");
  const [fy, setFy] = useState("2025");

  async function load() {
    setEngagements(await apiGet("/api/engagements"));
  }
  useEffect(() => { load(); }, []);

  async function create() {
    await apiPost("/api/engagements", { name, fiscal_year: fy });
    await load();
  }

  return (
    <main style={{ padding: 20, fontFamily: "system-ui" }}>
      <h1>Gov Financials Web MVP</h1>
      <p>Create an engagement, then upload TB, map, generate statements, add conversions, write MD&A with tokens.</p>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Entity name" />
        <input value={fy} onChange={(e)=>setFy(e.target.value)} placeholder="FY" style={{ width: 80 }} />
        <button onClick={create}>Create</button>
      </div>

      <h2 style={{ marginTop: 20 }}>Engagements</h2>
      <ul>
        {engagements.map(e => (
          <li key={e.id}>
            <b>{e.name}</b> (FY {e.fiscal_year}) — ID {e.id} —{" "}
            <a href={`/upload?e=${e.id}`}>Upload</a>{" | "}
            <a href={`/mapping?e=${e.id}`}>Mapping</a>{" | "}
            <a href={`/statements?e=${e.id}`}>Statements</a>{" | "}
            <a href={`/conversions?e=${e.id}`}>Conversions</a>{" | "}
            <a href={`/narrative?e=${e.id}`}>MD&A</a>
          </li>
        ))}
      </ul>
    </main>
  );
}
