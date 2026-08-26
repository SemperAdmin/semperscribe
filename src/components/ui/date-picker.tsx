"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date
  setDate: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

/**
 * Midnight local time, today.
 *
 * LOCAL, NOT UTC. Every caller converts back through toIsoDate, and a Date
 * built at UTC midnight prints as the previous day anywhere west of
 * Greenwich, which is most of the Marine Corps. Building it from the local
 * year, month and day keeps the printed date the one the clerk is looking
 * at on the wall.
 */
function todayLocal(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export function DatePicker({ date, setDate, placeholder = "Pick a date", className }: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "d MMM yy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d)
            // A single-date picker is finished the moment a day is chosen.
            // Leaving the popover open hides the field the value just landed
            // in, which is half of why picking a date felt awkward.
            if (d) setOpen(false)
          }}
          month={date}
          autoFocus
        />
        {/* TODAY, asked for by Stephen 2026-08-26. Most dates on this form
            are today's: the election is signed today, the punishment is
            imposed today, the notice is given today. Two clicks became one,
            and CLEAR sits beside it because a date entered by mistake had no
            way back out except reopening the calendar and hunting. */}
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => {
              setDate(todayLocal())
              setOpen(false)
            }}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => {
              setDate(undefined)
              setOpen(false)
            }}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
