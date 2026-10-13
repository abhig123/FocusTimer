type SoundOption = "none" | "bell1" | "bell2";

type RuntimeMessage = {
  type?: string;
  payload?: {
    sound?: SoundOption;
  };
};

const SOUND_FILE_BY_OPTION: Record<Exclude<SoundOption, "none">, string> = {
  bell1: "src/assets/Bell_1.mp3",
  bell2: "src/assets/Bell_2.mp3"
};

let activeAudio: HTMLAudioElement | null = null;

async function playAudioFile(path: string): Promise<void> {
  const url = chrome.runtime.getURL(path);

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }

  const audio = new Audio(url);
  activeAudio = audio;
  audio.preload = "auto";

  try {
    await audio.play();
  } catch (error) {
    if ((error as DOMException)?.name === "AbortError") {
      return;
    }
    throw error;
  }
}

async function playConfiguredSound(sound: SoundOption): Promise<void> {
  if (sound === "none") return;

  await playAudioFile(SOUND_FILE_BY_OPTION[sound]);
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type !== "PLAY_SOUND") {
    return;
  }

  const sound: SoundOption = message.payload?.sound === "bell1" || message.payload?.sound === "bell2"
    ? message.payload.sound
    : "none";

  void playConfiguredSound(sound)
    .then(() => sendResponse({ ok: true }))
    .catch((error: Error) => sendResponse({ ok: false, error: error.message || String(error) }));

  return true;
});
