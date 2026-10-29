import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="flex min-h-screen flex-col px-4 py-8 sm:px-6 lg:px-12">
        <Link href="/" className="self-start text-ink">
          <BrandMark />
        </Link>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
      </div>
      <div className="hidden bg-brand lg:sticky lg:top-0 lg:grid lg:h-screen lg:place-items-center">
        <Image
          src="/brand/three-queens-calzados.jpg"
          alt="Three Queens Calzados"
          width={1080}
          height={1080}
          priority
          className="w-[min(70%,28rem)] rounded-2xl shadow-2xl shadow-royal/25"
        />
      </div>
    </div>
  );
}
