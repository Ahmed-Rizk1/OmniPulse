"use client";

import React from "react";
import { TicketTable } from "@/components/layout/TicketTable";

export default function TicketsPage() {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <TicketTable />
    </div>
  );
}
