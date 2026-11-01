import { NextRequest, NextResponse } from "next/server";
import { assignOfficerToIncident } from "@/lib/db/incidents-db";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.officerId || !body.officerName) {
      return NextResponse.json(
        { success: false, message: "Missing officerId or officerName" },
        { status: 400 }
      );
    }

    const updated = assignOfficerToIncident(
      id,
      body.officerId,
      body.officerName,
      body.author || "Admin Command"
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Incident not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      incident: updated,
      message: `Incident ${updated.incidentNumber} assigned to ${body.officerName}.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to assign officer";
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
