'use client';
import { useState } from "react";

type CardProps = {
  data?: Record<string, any>;
};

const displayName = (data?: Record<string, any>) =>
  data?.nameKo || data?.name_ko || data?.nameEn || data?.name || "K-POP";

async function postJson(url: string, method = "POST") {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(String(res.status));
  }
  return res.json();
}

export function ArtistCard({ data }: CardProps) {
  const [status, setStatus] = useState("");
  const name = displayName(data);
  const imageUrl = data?.imageUrl || data?.image_url;

  const follow = async () => {
    try {
      await postJson(`/api/v1/kpop/artists/${data?.id}/follow`);
      setStatus("Following");
    } catch {
      setStatus("Login required");
    }
  };

  return (
    <article className="kpop-card">
      <div className="kpop-card-image">
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>{name.slice(0, 1)}</span>}
      </div>
      <div className="kpop-card-body">
        <p className="kpop-eyebrow">Artist</p>
        <h3>{name}</h3>
        <p>{data?.profile || "Follow events, fan routes, and reliable merch candidates."}</p>
        <button type="button" onClick={follow}>Follow</button>
        {status ? <small>{status}</small> : null}
      </div>
    </article>
  );
}

export function EventCard({ data }: CardProps) {
  const [status, setStatus] = useState("");
  const title = data?.titleKo || data?.title_ko || data?.titleEn || data?.title || "K-POP event";

  const bookmark = async () => {
    try {
      await postJson(`/api/v1/kpop/events/${data?.id}/bookmark`);
      setStatus("Bookmarked");
    } catch {
      setStatus("Login required");
    }
  };

  return (
    <article className="kpop-card kpop-event-card">
      <div className="kpop-card-body">
        <p className="kpop-eyebrow">{data?.artistNameKo || data?.artistName || "Event"}</p>
        <h3>{title}</h3>
        <p>{[data?.region, data?.venue, data?.date].filter(Boolean).join(" - ")}</p>
        <p className="kpop-evidence">Only official or reviewed links should be treated as reliable.</p>
        <button type="button" onClick={bookmark}>Bookmark</button>
        {status ? <small>{status}</small> : null}
      </div>
    </article>
  );
}
