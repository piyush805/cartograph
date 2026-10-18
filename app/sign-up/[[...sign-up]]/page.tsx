import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <div className="grid flex-1 place-items-center px-4 py-8">
      <Suspense>
        <SignUp />
      </Suspense>
    </div>
  );
}
