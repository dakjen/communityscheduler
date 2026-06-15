'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Slide = { key: string; title: string; content: ReactNode };

export default function HomeCarousel({
    slides,
    autoAdvanceMs = 6000,
}: { slides: Slide[]; autoAdvanceMs?: number }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const pointerStartX = useRef<number | null>(null);
    const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const SWIPE_THRESHOLD = 50;
    const PAUSE_MS = 15000;

    // Auto-flips when idle; any tap/click/swipe pauses it for a bit so popups
    // and reading aren't yanked away, then it resumes on its own.
    const markInteraction = () => {
        setPaused(true);
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(() => setPaused(false), PAUSE_MS);
    };

    useEffect(() => () => {
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
    }, []);

    useEffect(() => {
        if (!autoAdvanceMs || autoAdvanceMs <= 0) return;
        if (slides.length < 2) return;
        if (paused) return;
        const id = setInterval(() => {
            setIndex(prev => (prev + 1) % slides.length);
        }, autoAdvanceMs);
        return () => clearInterval(id);
    }, [autoAdvanceMs, slides.length, paused]);

    const go = (next: number) => {
        const n = slides.length;
        if (n === 0) return;
        setIndex(((next % n) + n) % n);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            go(index + (dx < 0 ? 1 : -1));
        }
        touchStartX.current = null;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.pointerType === 'touch') return;
        pointerStartX.current = e.clientX;
    };
    const handlePointerUp = (e: React.PointerEvent) => {
        if (pointerStartX.current == null) return;
        const dx = e.clientX - pointerStartX.current;
        if (Math.abs(dx) > SWIPE_THRESHOLD) {
            go(index + (dx < 0 ? 1 : -1));
        }
        pointerStartX.current = null;
    };

    return (
        <div
            className="space-y-3"
            onClickCapture={markInteraction}
            onPointerDownCapture={markInteraction}
            onTouchStartCapture={markInteraction}
        >
            <div className="flex items-center justify-between gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => go(index - 1)}
                    aria-label="Previous"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-700">{slides[index].title}</h2>
                    <div className="flex gap-1.5">
                        {slides.map((s, i) => (
                            <button
                                key={s.key}
                                aria-label={`Go to ${s.title}`}
                                onClick={() => go(i)}
                                className={cn(
                                    "h-2 rounded-full transition-all",
                                    i === index ? "w-6 bg-primary" : "w-2 bg-slate-300 hover:bg-slate-400"
                                )}
                            />
                        ))}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => go(index + 1)}
                    aria-label="Next"
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            <div
                className="overflow-hidden touch-pan-y select-none cursor-grab active:cursor-grabbing"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => { pointerStartX.current = null; }}
            >
                <div
                    className="flex transition-transform duration-300 ease-out"
                    style={{ transform: `translateX(-${index * 100}%)` }}
                >
                    {slides.map(slide => (
                        <div key={slide.key} className="w-full flex-shrink-0">
                            {slide.content}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
