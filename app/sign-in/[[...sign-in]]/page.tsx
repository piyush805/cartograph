import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <div className="grid flex-1 place-items-center px-4 py-8">
      <Suspense>
        <SignIn />
      </Suspense>
    </div>
  );
}
