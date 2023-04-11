

function onSend() {
  var value = (line.value || line.innerText).trim()

  if (!value) return

  addItem("user", value)
  postLine(value)

  line.value = ""
  line.innerText = ""
}

function addItem(type, content) {
  let request = document.createElement("div")
  request.className = type
  request.innerText = content
  box.appendChild(request)

  window.scrollTo({
    top: document.body.scrollHeight, behavior: "auto",
  })
  line.focus()

  return request
}

function postLine(line) {
  saveConv({ role: "user", content: line })
  let reqMsgs = []
  if (messages.length < 10) {
    reqMsgs.push(...messages)
  } else {
    reqMsgs.push(messages[0])
    reqMsgs.push(...messages.slice(messages.length - 7, messages.length))
  }
  if (config.model === "gpt-3.5-turbo") {
    chat(reqMsgs)
  } else {
    completions(reqMsgs)
  }
}

var convId;
var messages = [];
function chat(reqMsgs) {
  let assistantElem = addItem('', '')
  let _message = reqMsgs
  if (!config.multi) {
    _message = [reqMsgs[0], reqMsgs[reqMsgs.length - 1]]
  }
  send(`https://api.openai.com/v1/chat/completions`, {
    "model": "gpt-3.5-turbo",
    "messages": _message,
    "max_tokens": 2000,
    "stream": true
    "temperature": 0.5,
  }, (data) => {
    let msg = data.choices[0].delta || data.choices[0].message || {}
    assistantElem.className = 'assistant'
    assistantElem.innerText += msg.content || ""
  }, () => onSuccessed(assistantElem),)
}
function completions(reqMsgs) {
  let assistantElem = addItem('', '')
  let _prompt = ""
  if (config.multi) {
    reqMsgs.forEach(msg => {
      _prompt += `${msg.role}: ${msg.content}\n`
    });
  } else {
    _prompt += `${reqMsgs[0].role}: ${reqMsgs[0].content}\n`
    let lastMessage = reqMsgs[reqMsgs.length - 1]
    _prompt += `${lastMessage.role}: ${lastMessage.content}\n`
  }
  _prompt += "assistant: "
  send(`https://api.openai.com/v1/completions`, {
    "model": 'gpt-3.5-turbo',
    "prompt": _prompt,
    "max_tokens": 2000,
    "temperature": 0,
    "stop": ["\nuser: ", "\nassistant: "],
    "stream": true,
    "temperature": 0.5,
  }, (data) => {
    assistantElem.className = 'assistant'
    assistantElem.innerText += data.choices[0].text
  }, () => onSuccessed(assistantElem),)
}

function send(reqUrl, body, onMessage, scussionCall) {
  loader.hidden = false
  let onError = (data) => {
    console.error(data);
    loader.hidden = true
    if (!data) {
      addItem("system", `Unable to access OpenAI, please check your network.`)
    } else {
      try {
        let openai = JSON.parse(data)
        addItem("system", `${openai.error.message}`)
      } catch (error) {
        addItem("system", `${data}`)
      }
    }
  }
  if (!config.tts) {
    body.stream = true
    var source = new SSE(
      reqUrl, {
      headers: {
        "Authorization": "Bearer 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",
        "Content-Type": "application/json",
      },
      method: "POST",
      payload: JSON.stringify(body),
    });

    source.addEventListener("message", function (e) {
      if (e.data == "[DONE]") {
        loader.hidden = true
        scussionCall()
      } else {
        try {
          onMessage(JSON.parse(e.data))
        } catch (error) {
          onError(error)
        }
      }
    });

    source.addEventListener("error", function (e) {
      onError(e.data)
    });

    source.stream();
  } else {
    body.stream = false
    fetch(reqUrl, {
      method: "POST",
      headers: {
        "Authorization": "Bearer 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",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).then((resp) => {
      return resp.json()
    }).then((data) => {
      loader.hidden = true
      if (data.error) {
        throw new Error(`${data.error.code}: ${data.error.message}`)
      }
      onMessage(data)
      scussionCall()
    }).catch(onError)
  }
}


const convKey = "conversations_"
const convNameKey = "conversationName_"
function saveConv(message) {
  messages.push(message)
  localStorage.setItem(`${convKey}${convId}`, JSON.stringify(messages))
}

function switchConv(key) {
  if (key == null) {
    addItem("system", "No conversations")
    return
  }
  box.innerHTML = ''
  messages = JSON.parse(localStorage.getItem(key))
  messages.forEach(msg => {
    addItem(msg.role, msg.content)
  });
  convId = key.substring(convKey.length);
}

function deleteConv(key) {
  localStorage.removeItem(key)
}

function deleteAllHistory() {
  for (let index = 0; index < localStorage.length; index++) {
    let key = localStorage.key(index);
    if (key.substring(0, convKey.length) != convKey) { continue }
    deleteConv(key)
    showHistory(true)
  }
}

function saveConvName(key) {
  let input = document.getElementById(`input_${key}`)
  localStorage.setItem(`${convNameKey}${key}`, input.value)
  showHistory(true)
}

function updateConvName(key) {
  let name = document.getElementById(`name_${key}`)
  let input = document.getElementById(`input_${key}`)
  let update = document.getElementById(`update_${key}`)
  let del = document.getElementById(`delete_${key}`)
  input.hidden = false
  name.hidden = true
  del.hidden = true
  update.innerHTML = "📝"
  update.onclick = () => {
    saveConvName(key)
  }
}

function showHistory(ok = true) {
  if (ok) {
    historyModal.style.display = ''
    historyList.innerHTML = ''
    for (let index = 0; index < localStorage.length; index++) {
      let key = localStorage.key(index);
      if (key.substring(0, convKey.length) != convKey) { continue }
      let itemJson = localStorage.getItem(key)
      let itemData;
      try {
        itemData = JSON.parse(itemJson)
      } catch (error) {
        continue
      }
      let itemName = localStorage.getItem(`${convNameKey}${key}`)
      if (itemName) {
        historyList.innerHTML += `<div class="history-item">
      <div style="display: flex; align-items: center;">
        <div id="name_${key}" style="flex: 1;" onclick='switchConv("${key}"); showHistory(false);'>${itemName} (${itemData.length}+)</div>
        <input id="input_${key}" type="text" placeholder="会话名称" hidden />
        <button id="update_${key}" onclick='updateConvName("${key}");' class="icon" title="Save conversation name">🔧</button>
        <button id="delete_${key}" onclick='deleteConv("${key}"); showHistory(true);' class="icon" title="Delete">❌</button>
      </div></div>`
      } else {
        historyList.innerHTML += `<div class="history-item">
      <div style="display: flex; align-items: center; margin-bottom: 4px;">
        <input id="input_${key}" type="text" placeholder="会话名称" />
        <button onclick='saveConvName("${key}"); showHistory(true);' class="icon" title="Save conversation name">📝</button>
      </div>
      <div style="display: flex; align-items: center;">
        <div style="flex: 1;" onclick='switchConv("${key}"); showHistory(false);'>
          <div>SYST: ${itemData[0].content.replace(/<[^>]+>/g, '')}</div>
          <div>USER: ${itemData[1].content.replace(/<[^>]+>/g, '')} (${itemData.length}+)</div>
        </div>
        <button onclick='deleteConv("${key}"); showHistory(true);' class="icon" title="Delete">❌</button>
      </div></div>`
      }
    }
    if (0 == localStorage.length) {
      historyList.innerHTML = `<h4>There are no past conversations yet.</h4>`
    } else {
    }
  } else {
    historyModal.style.display = 'none'
  }
}

function showSettings(ok = true) {
  if (ok) {
    settingsModal.style.display = ''
    setSettingInput(config)
  } else {
    settingsModal.style.display = 'none'
  }
}


var config = {
  domain: "",
  apiKey: "",
  maxTokens: 500,
  model: "",
  firstPrompt: null,
  multi: true,
  stream: true,
  prompts: [],
  temperature: 0.5,
  tts: false,
  onlyWhisper: false,
}

function onSelectPrompt(index) {
  let prompt = config.prompts[index]
  systemPromptInput.value = prompt.content
  multiConvInput.checked = prompt.multi
  promptDetails.open = false
}

window.scrollTo(0, document.body.clientHeight)
init()

const promptDiv = (index, prompt) => {
  return `<div style="margin-top: 15px; cursor: pointer;" onclick="onSelectPrompt(${index})">
<div style="display: flex;">
  <strong style="flex: 1;">${prompt.title}</strong>
  <label style="display:  ${prompt.multi ? "" : "none"}; align-items: center; margin: 0">
    <span style="white-space: nowrap;">Long conversation</span>
    <input type="checkbox" style="width: 1.1rem; height: 1.1rem;" checked disabled/>
  </label>
</div>
<div style="margin-top: 2px;">${prompt.content}</div>
</div>`
}

const textToSpeech = async (text, options = {}) => {
  loader.hidden = false
  const synth = window.speechSynthesis;

  // Check if Web Speech API is available
  if (!('speechSynthesis' in window)) {
    loader.hidden = true
    alert("The current browser does not support text-to-speech");
    return;
  }

  // Detect language using franc library
  const { franc } = await import("https://cdn.jsdelivr.net/npm/franc@6.1.0/+esm");
  let lang = franc(text);
  if (lang === "" || lang === "und") {
    lang = navigator.language
  }
  if (lang === "cmn") {
    lang = "zh-CN"
  }

  // Get available voices and find the one that matches the detected language
  const voices = await new Promise(resolve => {
    const voices = synth.getVoices();
    resolve(voices);
  });
  const voice = voices.find(v => langEq(v.lang, lang) && !v.localService);
  if (!voice) {
    voice = voices.find(v => langEq(v.lang, navigator.language) && !v.localService);
  }

  // Create a new SpeechSynthesisUtterance object and set its parameters
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = options.rate || 1.0;
  utterance.pitch = options.pitch || 1.0;
  utterance.volume = options.volume || 1.0;

  // Speak the text
  synth.speak(utterance);
  utterance.addEventListener('boundary', (event) => {
    const { charIndex, elapsedTime } = event;
    const progress = charIndex / utterance.text.length;
    // console.log(`当前朗读进度：${progress * 100}%, 时间：${elapsedTime}`);
    loader.hidden = true
  });
};

const regionNamesInEnglish = new Intl.DisplayNames(['en'], { type: 'language' });
const langEq = (lang1, lang2) => {
  let langStr1 = regionNamesInEnglish.of(lang1)
  let langStr2 = regionNamesInEnglish.of(lang2)
  if (langStr1.indexOf(langStr2) !== -1) return true
  if (langStr2.indexOf(langStr1) !== -1) return true
  return langStr1 === langStr2
}

const getVoices = () => {
  return new Promise(resolve => {
    synth.onvoiceschanged = () => {
      const voices = synth.getVoices();
      resolve(voices);
    };
  });
}

var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
// var SpeechGrammarList = SpeechGrammarList || window.webkitSpeechGrammarList
// var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent
var recognition = null;
const _speechToText = () => {
  loader.hidden = false
  // const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition || window.mozSpeechRecognition || window.msSpeechRecognition)();
  if (!recognition) {
    recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.lang = recogLangInput.value;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      loader.hidden = true
      try {
        const speechResult = event.results[0][0].transcript;
        line.innerText = speechResult;
        // onSend()
      } catch (error) {
        addItem('system', `Speech recogniion result failed: ${error.message}`)
      }
    };

    recognition.onspeechend = function () {
      loader.hidden = true
      recognition.stop();
    };

    recognition.onnomatch = function (event) {
      loader.hidden = true
      addItem('system', `Speech recogniion match failed: ${event.error}`)
    }

    recognition.onerror = (event) => {
      loader.hidden = true
      addItem('system', `Speech recogniion error: ${event.error}, ${event}`)
    };
  }

  try {
    recognition.start();
  } catch (error) {
    onError(`Speech error: ${error}`)
  }
}

function _speechToText1() {
  loader.hidden = false
  // 获取音频流
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function (stream) {
      // 创建 MediaRecorder 对象
      const mediaRecorder = new MediaRecorder(stream);
      // 创建 AudioContext 对象
      const audioContext = new AudioContext();
      // 创建 MediaStreamAudioSourceNode 对象
      const source = audioContext.createMediaStreamSource(stream);
      // 创建 MediaStreamAudioDestinationNode 对象
      const destination = audioContext.createMediaStreamDestination();
      // 将 MediaStreamAudioDestinationNode 对象连接到 MediaStreamAudioSourceNode 对象
      source.connect(destination);
      // 将 MediaStreamAudioDestinationNode 对象的 MediaStream 传递给 MediaRecorder 对象
      mediaRecorder.stream = destination.stream;
      // 创建一个空的音频缓冲区
      let chunks = [];
      // 开始录音
      mediaRecorder.start();
      // 监听录音数据
      mediaRecorder.addEventListener('dataavailable', function (event) {
        chunks.push(event.data);
      });
      // 停止录音
      mediaRecorder.addEventListener('stop', function () {
        // 将录音数据合并为一个 Blob 对象
        const blob = new Blob(chunks, { type: 'audio/mp3' });
        // 创建一个 Audio 对象
        const audio = new Audio();
        // 将 Blob 对象转换为 URL
        const url = URL.createObjectURL(blob);
        // 设置 Audio 对象的 src 属性为 URL
        audio.src = url;
        // 播放录音
        audio.play();
        // asr
        transcriptions(getRecordFile(chunks, mediaRecorder.mimeType))
      });
      // 5 秒后停止录音
      setTimeout(function () {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
      }, 5000);
    })
    .catch(function (error) {
      console.error(error);
    });
}

const transcriptions = (file) => {
  const formData = new FormData();
  formData.append("model", "whisper-1");
  formData.append("file", file);
  formData.append("response_format", "json");
  fetch("https://openai.icsq.xyz/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + config.apiKey,
    },
    body: formData,
  }).then((resp) => {
    return resp.json()
  }).then((data) => {
    loader.hidden = true
    if (data.error) {
      throw new Error(`${data.error.code}: ${data.error.message}`)
    }
    line.innerText = data.text
    line.focus()
  }).catch(e => {
    loader.hidden = true
    addItem("system", e)
  })
}

const getRecordFile = (chunks, mimeType) => {
  const dataType = mimeType.split(';')[0];
  const fileType = dataType.split('/')[1];
  const blob = new Blob(chunks, { type: dataType });
  const name = `input.${fileType}`
  return new File([blob], name, { type: dataType })
}

const speechToText = () => {
  loader.hidden = false
  // 获取音频流
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(function (stream) {
      // 创建 MediaRecorder 对象
      const mediaRecorder = new MediaRecorder(stream);
      // 创建 AudioContext 对象
      const audioContext = new AudioContext();
      // 创建 MediaStreamAudioSourceNode 对象
      const source = audioContext.createMediaStreamSource(stream);
      // 创建 MediaStreamAudioDestinationNode 对象
      const destination = audioContext.createMediaStreamDestination();
      // 将 MediaStreamAudioDestinationNode 对象连接到 MediaStreamAudioSourceNode 对象
      source.connect(destination);
      // 将 MediaStreamAudioDestinationNode 对象的 MediaStream 传递给 MediaRecorder 对象
      mediaRecorder.stream = destination.stream;
      // 创建一个空的音频缓冲区
      let chunks = [];
      // 开始录音
      mediaRecorder.start();
      // 监听录音数据
      mediaRecorder.addEventListener('dataavailable', function (event) {
        chunks.push(event.data);
      });
      // 停止录音
      mediaRecorder.addEventListener('stop', function () {
        console.log("stop record");
        const audiofile = getRecordFile(chunks, mediaRecorder.mimeType)
        // 将录音数据合并为一个 Blob 对象
        // const blob = new Blob(chunks, { type: 'audio/mp3' });
        // 创建一个 Audio 对象
        const audio = new Audio();
        // 将 Blob 对象转换为 URL
        const url = URL.createObjectURL(audiofile);
        // 设置 Audio 对象的 src 属性为 URL
        audio.src = url;
        // 播放录音
        audio.play();
        // 如果仅使用 Whisper 识别，则直接调用
        if (config.onlyWhisper) {
          transcriptions(audiofile)
        }
      });
      if (config.onlyWhisper) {
        detectStopRecording(stream, 0.38, () => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
          stream.getTracks().forEach(track => track.stop());
        })
      } else {
        asr(
          onstop = () => {
            addItem("system", `Stoped record: read ${chunks.length} "${mediaRecorder.mimeType}" blob, and start recognition`);
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
            stream.getTracks().forEach(track => track.stop());
          },
          onnomatch = () => {
            transcriptions(getRecordFile(chunks, mediaRecorder.mimeType))
          },
          onerror = () => {
            transcriptions(getRecordFile(chunks, mediaRecorder.mimeType))
          })
      }
    })
    .catch(function (error) {
      console.error(error);
      addItem("system", error);
    });
}

const asr = (onstop, onnomatch, onerror) => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  const recognition = new SpeechRecognition()

  recognition.continuous = false;
  recognition.lang = recogLangInput.value;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    loader.hidden = true
    try {
      const speechResult = event.results[0][0].transcript;
      line.innerText = speechResult;
      // onSend()
    } catch (error) {
      addItem('system', `Speech recogniion result failed: ${error.message}`)
    }
  };

  recognition.onspeechend = function () {
    recognition.stop();
    onstop();
  };

  recognition.onnomatch = onnomatch

  recognition.onerror = onerror

  try {
    recognition.start();
  } catch (error) {
    onerror()
  }
}

function detectStopRecording(stream, maxThreshold, callback) {
  const audioContext = new AudioContext();
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const analyzerNode = audioContext.createAnalyser();
  analyzerNode.fftSize = 2048;
  analyzerNode.smoothingTimeConstant = 0.8;
  sourceNode.connect(analyzerNode);
  const frequencyData = new Uint8Array(analyzerNode.frequencyBinCount);
  var startTime = null;
  const check = () => {
    analyzerNode.getByteFrequencyData(frequencyData);
    const amplitude = Math.max(...frequencyData) / 255;
    console.log(`amplitude: ${amplitude}`);
    if (amplitude >= maxThreshold) {
      console.log("speeching");
      startTime = new Date().getTime();
      requestAnimationFrame(check);
    } else if (startTime && (new Date().getTime() - startTime) > 1000) {
      callback('stop');
    } else {
      console.log("no speech");
      requestAnimationFrame(check);
    }
  };
  requestAnimationFrame(check);
}
