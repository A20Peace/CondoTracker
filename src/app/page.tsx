import { redirect } from "next/navigation";

export default function Home() {
  // The middleware already gates auth; send everyone to the home landing page.
  redirect("/home");
}
