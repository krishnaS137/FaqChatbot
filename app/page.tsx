// app/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import RoboIcon from "./assets/robot-bot-icon.svg";
import { useChat } from "@ai-sdk/react";
import PromptSuggestionsRow from "./components/PromptSuggestionsRow";
import LoadingBubble from "./components/LoadingBubble";
import Bubble from "./components/Bubble";

/**
 * Chat page component that:
 * - uses useChat({ api: "/api/chat" }) for history/append
 * - streams a server response and shows it in a single streaming bubble
 * - keeps a .scrollable container as the actual scroll target
 * - only auto-scrolls when the user is near the bottom
 */

const SCROLL_NEAR_BOTTOM_PX = 120;

const Home: React.FC = () => {
  // useChat for history rendering + append
  const { append, isLoading: aiLoading, messages, input, handleInputChange } = useChat({
    api: "/api/chat",
  });

  // streaming local state
  const [streamingAssistant, setStreamingAssistant] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ref for the actual scrollable element
  const scrollableRef = useRef<HTMLDivElement | null>(null);

  // user scroll tracking
  const userScrolledRef = useRef(false);
  const [userScrolled, setUserScrolled] = useState(false);

  const noMessages = !messages || messages.length === 0;

  // check near bottom helper
  const isNearBottom = (el: HTMLElement | null, threshold = SCROLL_NEAR_BOTTOM_PX) => {
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollHeight - (scrollTop + clientHeight) <= threshold;
  };

  // scroll to bottom helper
  const scrollToBottom = (smooth = true) => {
    const el = scrollableRef.current;
    if (!el) return;
    if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    else el.scrollTop = el.scrollHeight;
  };

  // attach scroll listener to scrollable element once
  useEffect(() => {
    const el = scrollableRef.current;
    if (!el) return;

    const onScroll = () => {
      const nearBottom = isNearBottom(el);
      userScrolledRef.current = !nearBottom;
      setUserScrolled(!nearBottom);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // run once to initialize state
    onScroll();

    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll when messages or streamingAssistant change, but only if user hasn't scrolled up
  useEffect(() => {
    if (userScrolledRef.current) return;
    requestAnimationFrame(() => scrollToBottom(false));
  }, [messages, streamingAssistant]);

  // streaming function (posts prompt, reads streamed response)
  async function sendStreamedPrompt(promptText: string) {
    if (!promptText || promptText.trim().length === 0) return;

    // 1) append user message to history
    append({ role: "user", content: promptText } as any);

    // 2) prepare streaming UI
    setStreamingAssistant("");
    setLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: promptText }] }),
      });

      if (!resp.ok || !resp.body) {
        const txt = await resp.text();
        append({ role: "assistant", content: "Error: " + txt } as any);
        setStreamingAssistant(null);
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulator = "";

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          accumulator += chunk;
          setStreamingAssistant(accumulator);

          // auto-scroll while streaming only if user hasn't scrolled up
          if (!userScrolledRef.current) {
            requestAnimationFrame(() => scrollToBottom(false));
          }
        }
      }

      // finalise: append final assistant message to history, clear streaming
      append({ role: "assistant", content: accumulator } as any);
      setStreamingAssistant(null);
    } catch (err: any) {
      console.error("streaming error:", err);
      append({ role: "assistant", content: "Error streaming response: " + String(err) } as any);
      setStreamingAssistant(null);
    } finally {
      setLoading(false);
    }
  }

  const handlePrompt = (promptText: string) => sendStreamedPrompt(promptText);

  const handleSubmitWrapped = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = (input ?? "").toString().trim();
    if (trimmed.length === 0) return;
    sendStreamedPrompt(trimmed);
  };

  return (
    <main>
      <Image src={RoboIcon} alt="Icon for the project" width={135} />

      {/* section contains the scrollable div */}
      <section className={noMessages ? "" : "populated"}>
        <div
          className="scrollable"
          ref={(el) => {
            scrollableRef.current = el;
          }}
        >
          {noMessages ? (
            <>
              <p className="starter-text">
                Your go-to hub for all Operating Systems knowledge! Ask OS-GPT anything—from
                process management and memory allocation to deadlocks and scheduling algorithms—and
                get clear, accurate, and up-to-date answers. Dive in and make learning Operating
                Systems easier than ever!
              </p>
              <br />
              <PromptSuggestionsRow onPromptClick={handlePrompt} />
            </>
          ) : (
            <>
              <div className="message-list">
                {messages.map((message: any, index: number) => (
                  <Bubble key={`message-${index}`} message={message} />
                ))}
              </div>

              {streamingAssistant !== null && (
                <Bubble message={{ role: "assistant", content: streamingAssistant }} />
              )}

              {(loading || aiLoading) && <LoadingBubble />}
            </>
          )}
        </div>
      </section>

      <form onSubmit={handleSubmitWrapped}>
        <input
          title="Input for question box"
          className="question-box"
          onChange={handleInputChange}
          value={input ?? ""}
          placeholder="Ask me something..."
        />
        <input type="submit" />
      </form>

      {userScrolled && (
        <button
          className="scroll-to-bottom-btn"
          onClick={() => {
            scrollToBottom(true);
            userScrolledRef.current = false;
            setUserScrolled(false);
          }}
          aria-label="Scroll to bottom"
        >
          ⬇
        </button>
      )}
    </main>
  );
};

export default Home;
