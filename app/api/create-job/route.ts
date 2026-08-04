import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const title = body.title?.trim();
    const company = body.company?.trim() || "Unknown";
    const skills =
      typeof body.skills === "string"
        ? body.skills
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : body.skills || [];

    const description = body.description?.trim() || "";

    if (!title) {
      return NextResponse.json(
        { error: "Job title is required" },
        { status: 400 }
      );
    }

    /*
      CHECK EXISTING JOB
      Prevent duplicate title + company
    */
    const { data: existingJob } = await supabase
      .from("jobs")
      .select("*")
      .eq("title", title)
      .eq("company", company)
      .maybeSingle();

    /*
      UPDATE EXISTING JOB
    */
    if (existingJob) {
      console.log("UPDATING EXISTING JOB");

      const { data, error } = await supabase
        .from("jobs")
        .update({
          skills,
          description,
        })
        .eq("id", existingJob.id)
        .select()
        .single();

      if (error) {
        console.error(error);

        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        updated: true,
        job: data,
      });
    }

    /*
      CREATE NEW JOB
    */
    console.log("CREATING NEW JOB");

    const { data, error } = await supabase
      .from("jobs")
      .insert([
        {
          title,
          company,
          skills,
          description,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      created: true,
      job: data,
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        error: err.message || "Internal server error",
      },
      { status: 500 }
    );
  }
}