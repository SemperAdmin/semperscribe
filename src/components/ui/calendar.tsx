"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      /**
       * react-day-picker v9 CLASS KEYS. This block was written for v8 and
       * left behind when the dependency moved to v9 (9.14.0 installed,
       * "^9.8.0" in package.json). Almost every key it used was renamed:
       * head_row became weekdays, head_cell became weekday, row became
       * week, cell became day, day became day_button, caption became
       * month_caption, nav_button_previous became button_previous, and the
       * modifier keys day_selected, day_today, day_outside and day_disabled
       * became selected, today, outside and disabled.
       *
       * v9 IGNORES AN UNKNOWN KEY SILENTLY, so none of the layout classes
       * were applied and the grid fell back to unstyled defaults. That is
       * the misalignment Stephen reported on 2026-08-26: the weekday header
       * printing "Su" alone at the left with "Mo Tu We Th Fr Sa" bunched to
       * the right of it, because `weekdays: flex` and the fixed `weekday`
       * width never reached the DOM.
       *
       * The `Chevron` override below was already v9-only, so the file was
       * half migrated and the half that silently degraded is the half
       * nobody had looked at.
       *
       * Key names are taken from the installed package's own UI, DayFlag
       * and SelectionState enums, not from memory.
       */
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center h-7",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-0 top-1 flex items-center justify-between px-1 z-10",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button:hover]:bg-primary [&>button:hover]:text-primary-foreground",
        today: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...props }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
