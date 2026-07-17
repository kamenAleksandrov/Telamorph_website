"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const syncOtherField = initInquiryType();
  initCopyEmail();
  initContactForm(syncOtherField);
});

function initInquiryType() {
  const select = document.getElementById("inquiry-type");
  const field = document.getElementById("other-description-field");
  const input = document.getElementById("other-description");
  if (!select || !field || !input) return () => {};

  const presetType = new URLSearchParams(location.search).get("type");
  if (presetType && /^[a-z-]+$/.test(presetType)) {
    const match = Array.from(select.options).find(
      (option) => option.value === presetType,
    );
    if (match) select.value = presetType;
  }

  const sync = () => {
    const visible = select.value === "other";
    field.hidden = !visible;
    field.classList.toggle("is-visible", visible);
    input.disabled = !visible;
    if (!visible) input.value = "";
  };

  select.addEventListener("change", sync);
  sync();
  return sync;
}

function notify(message, { success = false } = {}) {
  const status = document.getElementById("contact-form-status");
  if (status) {
    status.textContent = message;
    status.classList.toggle("is-success", success);
    status.classList.toggle("is-error", !success);
  }
  if (typeof window.showToast === "function") {
    window.showToast(message, { variant: success ? "success" : undefined });
  }
}

function initCopyEmail() {
  const button = document.getElementById("copy-email-btn");
  if (!button) return;

  const email = button.dataset.email;
  const original = button.textContent.trim();
  let resetTimer;

  const flash = (label) => {
    clearTimeout(resetTimer);
    button.textContent = label;
    button.classList.add("is-copied");
    resetTimer = setTimeout(() => {
      button.textContent = original;
      button.classList.remove("is-copied");
    }, 1800);
  };

  const fallbackCopy = () => {
    const textarea = document.createElement("textarea");
    textarea.value = email;
    textarea.setAttribute("readonly", "");
    textarea.className = "clipboard-fallback";
    document.body.appendChild(textarea);
    textarea.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    textarea.remove();
    return copied;
  };

  button.addEventListener("click", async () => {
    let copied = false;
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(email);
        copied = true;
      } catch {
        copied = false;
      }
    }
    if (!copied) copied = fallbackCopy();
    flash(copied ? "Copied!" : email);
    notify(
      copied
        ? "Email copied to clipboard"
        : "Couldn't copy — email shown instead",
      { success: copied },
    );
  });
}

function createSubmissionId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  if (typeof webCrypto?.getRandomValues !== "function") return null;

  const bytes = webCrypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

function initContactForm(syncOtherField) {
  const form = document.getElementById("contact-form");
  const button = document.getElementById("submit-btn");
  const message = document.getElementById("message");
  const countWrap = document.getElementById("message-count");
  const countNumber = document.getElementById("message-count-num");
  if (!form || !button || !message) return;

  let submissionId = null;
  let sending = false;

  const updateCount = () => {
    if (!countWrap || !countNumber) return;
    const max = Number(message.getAttribute("maxlength")) || 3000;
    const length = message.value.length;
    countNumber.textContent = length.toLocaleString();
    countWrap.classList.toggle("is-near", length >= max * 0.9);
  };

  message.addEventListener("input", updateCount);
  form.addEventListener("input", () => {
    if (!sending) submissionId = null;
  });
  updateCount();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    sending = true;
    button.disabled = true;
    button.textContent = "Sending…";
    submissionId ||= createSubmissionId();

    const data = {
      "inquiry-type": form.elements.namedItem("inquiry-type").value,
      "other-description": form.elements.namedItem("other-description").value,
      name: form.elements.namedItem("name").value,
      company: form.elements.namedItem("company").value,
      email: form.elements.namedItem("email").value,
      subject: form.elements.namedItem("subject").value,
      message: form.elements.namedItem("message").value,
      contact_reason_2: form.elements.namedItem("contact_reason_2").value,
      ...(submissionId ? { submission_id: submissionId } : {}),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "same-origin",
      });

      const responseType = response.headers.get("content-type") || "";
      const payload = responseType.includes("application/json")
        ? await response.json().catch(() => null)
        : null;

      if (!response.ok || payload?.success !== true) {
        const error = new Error("Submission failed");
        error.status = response.status;
        throw error;
      }

      notify("Message sent — we'll get back to you shortly", { success: true });
      submissionId = null;
      form.reset();
      syncOtherField();
      updateCount();
    } catch (error) {
      if (error.name === "AbortError") {
        notify("Sending timed out. Please retry or email us directly.");
      } else if (error.status === 429) {
        notify("Too many recent attempts. Please wait or email us directly.");
      } else if (error.status === 400 || error.status === 413) {
        notify("Please review the form details, then try again.");
      } else if (error.status === 409) {
        notify("That message is already processing. Please wait before retrying.");
      } else {
        notify(
          "Message could not be sent. Your text is preserved; please retry or email us directly.",
        );
      }
    } finally {
      clearTimeout(timeout);
      sending = false;
      button.disabled = false;
      button.textContent = "Send message";
    }
  });
}
