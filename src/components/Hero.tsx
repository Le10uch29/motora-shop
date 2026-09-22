import Image from "next/image";

/** One hero banner.
 *
 * `src` is the desktop picture, cut for a 1920×600 (3.2:1) banner — that's the
 * shape the section takes from 1280px up. `mobileSrc` is an optional second
 * cut for phones, where the desktop one would lose too much top and bottom;
 * without it the same picture is used throughout. `position` decides what
 * stays in frame when a picture is wider or taller than the slot it fills. */
type HeroSlide = {
  src: string;
  mobileSrc?: string;
  position?: string;
};

/** Written as a list so more banners can be added later — a second entry is
 * where a carousel (autoplay, arrows, dots, swipe) would begin. */
const SLIDES: HeroSlide[] = [
  // Framed from the top: at 3.2:1 only the middle 46% of this picture's
  // height fits, and centring it cut off the flag and the ARAZ MOTORS logo.
  { src: "/hero-1.png", position: "50% 0%" },
];

/** The banner on the home page. Its height comes from a fixed aspect ratio per
 * breakpoint rather than a pixel height, so it scales with the screen and
 * never leaves empty space beside the picture: 4:3 on phones, widening in
 * steps to the 3.2:1 desktop format. Every slide shares that ratio, so slides
 * are the same height as each other. */
export default function Hero() {
  const slide = SLIDES[0];

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl shadow-xl sm:aspect-[16/9] md:aspect-[21/9] xl:aspect-[16/5]">
      {slide.mobileSrc && (
        <Image
          src={slide.mobileSrc}
          alt=""
          fill
          preload
          quality={100}
          sizes="100vw"
          className="object-cover sm:hidden"
          style={{ objectPosition: slide.position }}
        />
      )}
      <Image
        src={slide.src}
        alt=""
        fill
        preload
        quality={100}
        sizes="100vw"
        className={`object-cover ${slide.mobileSrc ? "hidden sm:block" : ""}`}
        style={{ objectPosition: slide.position }}
      />
    </div>
  );
}
