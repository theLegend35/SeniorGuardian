import { redirect } from "next/navigation";

export default function DoctorUploadRedirect() {
  redirect("/doctor/records");
}
