"use client";

import { useEffect, useRef } from "react";
import rrwebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";

interface ReplayPlayerProps {
  eventsUrl: string;
}

const getPlayerSize = (container: HTMLDivElement) => {
  const rect = container.getBoundingClientRect();

  return {
    width: Math.floor(rect.width),
    height: Math.floor(rect.height)-80,
  };
};


export default function ReplayPlayer({ eventsUrl }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || !eventsUrl) return;

    containerRef.current.innerHTML = "";

    const fetchAndPlay = async () => {
      try {
         const res = await fetch(eventsUrl, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch recording data");

         const data = await res.json();
         const events = Array.isArray(data) ? data : data?.events;
         
         if (!Array.isArray(events) || events.length === 0) {
           throw new Error(
             "Replay data is not a non-empty events array. Expected JSON to be an array or { events: [...] }."
           );
         }

        const size = getPlayerSize(containerRef.current!);
          playerRef.current = new rrwebPlayer({
          target: containerRef.current!,
          props: {
            events,
            autoPlay: true,
            showController: true,
            width: size.width,
            height: size.height,
          },
        });

         try {
           playerRef.current.play?.();
         } catch {}

         try {
           playerRef.current.triggerResize?.();
         } catch {}
      } catch (err) {
        console.error(err);
         if (!containerRef.current) return;
         containerRef.current.innerHTML = `
          <div style="color:red; padding:16px; text-align:center;">
             Failed to load replay data
          </div>
        `;
      }
    };

    fetchAndPlay();

    return () => {
       try {
         playerRef.current?.$destroy?.();
       } catch {}
       playerRef.current = null;
       containerRef.current!.innerHTML = "";
    };
  }, [eventsUrl]);

  return (
    <div className="w-full flex justify-center">
      <div
        ref={containerRef}
        className=" rr-player-wrapper w-full bg-black border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
      />
    </div>
  );
}
