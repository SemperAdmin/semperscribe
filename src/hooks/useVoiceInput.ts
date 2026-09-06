'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ParagraphData } from '@/types';
import { logError } from '@/lib/console-utils';

/**
 * Hook for browser SpeechRecognition-based voice input.
 * Manages recognition state and appends transcripts to paragraphs.
 */
export function useVoiceInput(
  paragraphs: ParagraphData[],
  updateParagraphContent: (id: number, content: string) => void
) {
  const [activeVoiceInput, setActiveVoiceInput] = useState<number | null>(null);

  const activeVoiceInputRef = useRef<number | null>(null);
  const paragraphsRef = useRef<ParagraphData[]>(paragraphs);
  const updateParagraphContentRef = useRef(updateParagraphContent);

  // Keep refs in sync. The recogniser's callbacks read these, so one
  // recogniser serves the hook's whole lifetime whatever the props do.
  useEffect(() => {
    activeVoiceInputRef.current = activeVoiceInput;
  }, [activeVoiceInput]);

  useEffect(() => {
    paragraphsRef.current = paragraphs;
  }, [paragraphs]);

  useEffect(() => {
    updateParagraphContentRef.current = updateParagraphContent;
  }, [updateParagraphContent]);

  // One recogniser per hook instance, created on the first press of the
  // mic (an event handler), never at mount and never during render.
  // Returns null where the browser has no SpeechRecognition.
  const recognitionRef = useRef<any>(null);
  const getRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = function (event: any) {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript && activeVoiceInputRef.current !== null) {
        const currentParagraph = paragraphsRef.current.find(p => p.id === activeVoiceInputRef.current);
        if (currentParagraph) {
          const newContent = currentParagraph.content + (currentParagraph.content ? ' ' : '') + finalTranscript;
          updateParagraphContentRef.current(activeVoiceInputRef.current, newContent);
        }
      }
    };

    recognition.onerror = function (event: any) {
      logError('Voice Recognition', event.error);
      setActiveVoiceInput(null);
    };

    recognition.onend = function () {
      setActiveVoiceInput(null);
    };

    recognitionRef.current = recognition;
    return recognition;
  }, []);

  const toggleVoiceInput = useCallback((paragraphId: number) => {
    const voiceRecognition = getRecognition();
    if (!voiceRecognition) {
      alert('Voice recognition not supported in this browser');
      return;
    }
    if (activeVoiceInput === paragraphId) {
      voiceRecognition.stop();
      setActiveVoiceInput(null);
    } else {
      if (activeVoiceInput !== null) voiceRecognition.stop();
      setActiveVoiceInput(paragraphId);
      voiceRecognition.start();
    }
  }, [getRecognition, activeVoiceInput]);

  return {
    activeVoiceInput,
    toggleVoiceInput,
  };
}
