"use client";

import { useEffect, useState } from "react";

export default function WeddingCountdown() {
    const weddingDate = new Date("2025-12-13T00:00:00");
    const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

    useEffect(() => {
        const calculateDaysRemaining = () => {
            const now = new Date();
            // Set wedding date to start of day
            const wedding = new Date("2025-12-13");
            wedding.setHours(0, 0, 0, 0);

            // Set now to start of day for accurate day count
            const today = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
            );

            const difference = wedding.getTime() - today.getTime();

            if (difference <= 0) {
                return 0;
            }

            return Math.ceil(difference / (1000 * 60 * 60 * 24));
        };

        // Set initial days
        setDaysRemaining(calculateDaysRemaining());

        // Update once per day at midnight
        const timer = setInterval(
            () => {
                setDaysRemaining(calculateDaysRemaining());
            },
            1000 * 60 * 60,
        ); // Update every hour to catch day changes

        return () => clearInterval(timer);
    }, []);

    if (daysRemaining === null) {
        return null; // Prevent hydration mismatch
    }

    return (
        <div className="mb-8 text-center">
            <div className="mb-2 text-2xl font-semibold text-white">
                13th December 2025
            </div>
            <div className="mb-4 text-lg text-gray-300">Clitheroe, UK</div>
            <div className="text-xl font-semibold text-[#d4af37]">
                {daysRemaining === 0
                    ? "Today's the day! 🎉"
                    : daysRemaining < 0
                      ? "Just Married! 💍"
                      : `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"} to go`}
            </div>
        </div>
    );
}
