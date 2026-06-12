<script setup lang="ts">
import {
  AdjustmentsHorizontalIcon,
  CpuChipIcon,
  GlobeAsiaAustraliaIcon,
} from "@heroicons/vue/24/outline";
import type { FunctionalComponent } from "vue";

import { content } from "~/content";

const appUrl = useRuntimeConfig().public.appUrl;

const featureIcons: Record<string, FunctionalComponent> = {
  ai: CpuChipIcon,
  map3d: GlobeAsiaAustraliaIcon,
  preset: AdjustmentsHorizontalIcon,
};

useSeoMeta({
  title: "峠サーチャー｜愛車と語り合える道がここにある",
  description:
    "日本全国の国土データをAIで解析し、走って楽しいワインディングロードを3D地図で探せる「峠サーチャー」。インストール不要・無料。",
});
</script>

<template>
  <div class="bg-white text-ink">
    <!-- ヘッダー -->
    <header class="border-b border-hairline">
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" class="flex items-center gap-2.5">
          <span class="rounded bg-accent px-1.5 py-1 text-sm leading-none font-bold text-white">
            峠
          </span>
          <span class="text-sm font-bold tracking-wide">
            峠サーチャー <span class="text-xs text-ink-soft">3D</span>
          </span>
        </a>
        <div class="flex items-center gap-6">
          <a href="#features" class="hidden text-sm text-ink-soft hover:text-ink sm:block">機能</a>
          <a href="#how" class="hidden text-sm text-ink-soft hover:text-ink sm:block">使い方</a>
          <a
            :href="appUrl"
            class="rounded-md bg-accent px-4 py-2 text-sm font-bold text-white hover:bg-accent/90"
          >
            アプリを開く
          </a>
        </div>
      </nav>
    </header>

    <main>
      <!-- ヒーロー -->
      <section class="mx-auto max-w-3xl px-6 py-24 text-center sm:py-32">
        <h1 class="text-3xl font-bold tracking-tight text-balance sm:text-5xl sm:leading-tight">
          {{ content.title }}
        </h1>
        <p class="mt-8 text-sm leading-7 whitespace-pre-line text-ink-soft sm:text-base sm:leading-8">
          {{ content.subTitle }}
        </p>
        <div class="mt-10 flex flex-col items-center gap-3">
          <a
            :href="appUrl"
            class="rounded-md bg-accent px-8 py-3.5 text-base font-bold text-white shadow-sm hover:bg-accent/90"
          >
            {{ content.hero.cta }}
          </a>
          <p class="text-xs text-ink-soft">{{ content.hero.ctaNote }}</p>
        </div>
      </section>

      <!-- 機能 -->
      <section id="features" class="bg-paper py-20 sm:py-24">
        <div class="mx-auto max-w-6xl px-6">
          <h2 class="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            道を「探す」から「選ぶ」へ
          </h2>
          <div class="mt-14 grid gap-10 sm:grid-cols-3">
            <div v-for="f in content.features" :key="f.key">
              <component :is="featureIcons[f.key]" class="size-7 text-accent" aria-hidden="true" />
              <h3 class="mt-4 text-base font-bold">{{ f.name }}</h3>
              <p class="mt-2 text-sm leading-6 text-ink-soft">{{ f.description }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 使い方 -->
      <section id="how" class="py-20 sm:py-24">
        <div class="mx-auto max-w-6xl px-6">
          <h2 class="text-center text-2xl font-bold tracking-tight sm:text-3xl">使い方は3ステップ</h2>
          <ol class="mt-14 grid gap-10 sm:grid-cols-3">
            <li v-for="(s, i) in content.steps" :key="s.name">
              <span
                class="flex size-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white"
              >
                {{ i + 1 }}
              </span>
              <h3 class="mt-4 text-base font-bold">{{ s.name }}</h3>
              <p class="mt-2 text-sm leading-6 text-ink-soft">{{ s.description }}</p>
            </li>
          </ol>
        </div>
      </section>

      <!-- CTA -->
      <section class="border-t border-hairline py-20 text-center sm:py-24">
        <div class="mx-auto max-w-2xl px-6">
          <h2 class="text-2xl font-bold tracking-tight sm:text-3xl">今日の一本を見つけよう</h2>
          <a
            :href="appUrl"
            class="mt-8 inline-block rounded-md bg-accent px-8 py-3.5 text-base font-bold text-white shadow-sm hover:bg-accent/90"
          >
            {{ content.hero.cta }}
          </a>
        </div>
      </section>
    </main>

    <footer class="border-t border-hairline py-8">
      <div
        class="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 text-xs text-ink-soft sm:flex-row sm:justify-between"
      >
        <p>© 峠サーチャー</p>
        <p>{{ content.footer.credit }}</p>
      </div>
    </footer>
  </div>
</template>
