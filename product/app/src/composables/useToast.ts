// アプリ全体で1つを共有するトースト通知。

import { readonly, ref, type Ref } from "vue";

interface Toast {
  message: Readonly<Ref<string>>;
  visible: Readonly<Ref<boolean>>;
  show(msg: string): void;
}

const message = ref("");
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

export const useToast = (): Toast => ({
  message: readonly(message),
  visible: readonly(visible),
  show: (msg) => {
    message.value = msg;
    visible.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      visible.value = false;
    }, 3500);
  },
});
