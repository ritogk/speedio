// 回転ボタンの操作: 長押しで連続回転、短いタップで45°回転（dir=1で地図が左回りに見える方向）。

import { onMounted, onUnmounted, type Ref } from "vue";

import { useMapInstance } from "@/composables/useMapInstance";
import { useToast } from "@/composables/useToast";

let holdHintShown = false;

export const useHoldRotate = (
  btn: Ref<HTMLElement | null>,
  dir: 1 | -1,
): void => {
  const { map } = useMapInstance();
  const { show: toast } = useToast();
  let raf: number | null = null;
  let t0 = 0;

  const step = () => {
    map.value?.setBearing(map.value.getBearing() + dir * 1.6);
    raf = requestAnimationFrame(step);
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    t0 = performance.now();
    if (raf !== null) cancelAnimationFrame(raf);
    step();
  };
  const onEnd = () => {
    if (!t0) return;
    if (raf !== null) cancelAnimationFrame(raf);
    if (performance.now() - t0 < 250) {
      map.value?.easeTo({
        bearing: map.value.getBearing() + dir * 45,
        duration: 400,
      });
      if (!holdHintShown) {
        holdHintShown = true;
        toast("回転ボタンは長押しでまわり続けます");
      }
    }
    t0 = 0;
  };

  onMounted(() => {
    const el = btn.value;
    if (!el) return;
    el.addEventListener("pointerdown", onDown);
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
      el.addEventListener(ev, onEnd);
    }
  });
  onUnmounted(() => {
    if (raf !== null) cancelAnimationFrame(raf);
    const el = btn.value;
    if (!el) return;
    el.removeEventListener("pointerdown", onDown);
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) {
      el.removeEventListener(ev, onEnd);
    }
  });
};
