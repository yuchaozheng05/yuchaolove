/* yuchaolove — app.js */

let imageBase64 = null;
let imageMediaType = 'image/jpeg';
let selectedStyle = '温暖体贴';

/* ===== File Upload ===== */
document.getElementById('fileInput').addEventListener('change', function (e) {
  const file = e.target.files[0];
    if (!file) return;
      imageMediaType = file.type || 'image/jpeg';

        const reader = new FileReader();
          reader.onload = function (ev) {
              imageBase64 = ev.target.result.split(',')[1];
                  document.getElementById('previewImg').src = ev.target.result;
                      document.getElementById('previewName').textContent = file.name;
                          document.getElementById('previewSize').textContent = (file.size / 1024).toFixed(0) + ' KB';
                              document.getElementById('previewBox').style.display = 'flex';
                                  document.getElementById('uploadZone').style.display = 'none';
                                      document.getElementById('results').style.display = 'none';
                                          const btn = document.getElementById('submitBtn');
                                              btn.disabled = false;
                                                  document.getElementById('btnText').textContent = '开始分析';
                                                    };
                                                      reader.readAsDataURL(file);
                                                      });

                                                      /* ===== Style Chips ===== */
                                                      document.getElementById('chipGroup').addEventListener('click', function (e) {
                                                        const chip = e.target.closest('.chip');
                                                          if (!chip) return;
                                                            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                                                              chip.classList.add('active');
                                                                selectedStyle = chip.dataset.style;
                                                                });

                                                                /* ===== Reset Upload ===== */
                                                                function resetUpload() {
                                                                  imageBase64 = null;
                                                                    document.getElementById('uploadZone').style.display = 'block';
                                                                      document.getElementById('previewBox').style.display = 'none';
                                                                        document.getElementById('fileInput').value = '';
                                                                          document.getElementById('results').style.display = 'none';
                                                                            const btn = document.getElementById('submitBtn');
                                                                              btn.disabled = true;
                                                                                document.getElementById('btnText').textContent = '上传截图后开始分析';
                                                                                }

                                                                                function scrollToApp() {
                                                                                  document.getElementById('app-section').scrollIntoView({ behavior: 'smooth' });
                                                                                  }

                                                                                  const TAG_CLASS = {
                                                                                    '温暖体贴': 'tag-warm',
                                                                                      '幽默俏皮': 'tag-playful',
                                                                                        '自然真诚': 'tag-natural',
                                                                                          '制造好奇': 'tag-curious'
                                                                                          };

                                                                                          /* ===== Main Analyze ===== */
                                                                                          async function analyze() {
                                                                                            if (!imageBase64) return;

                                                                                              const btn = document.getElementById('submitBtn');
                                                                                                btn.disabled = true;
                                                                                                  document.getElementById('btnText').textContent = '分析中…';
                                                                                                    document.getElementById('loadingState').style.display = 'block';
                                                                                                      document.getElementById('results').style.display = 'none';

                                                                                                        const context = document.getElementById('contextInput').value.trim();

                                                                                                          const prompt = `你是一位擅长分析情感关系、帮助人追求喜欢对象的情感顾问。

                                                                                                          请仔细阅读我上传的聊天截图，完成以下两项任务：

                                                                                                          【任务一】分析对方当前的态度
                                                                                                          - 判断对方的兴趣程度（从信号强弱、回复温度、主动程度等维度）
                                                                                                          - 给出一个简短的态度标签（8字以内）
                                                                                                          - 写一段100字以内的具体分析，指出关键信号，并给出策略建议
                                                                                                          - 如果对方态度非常冷淡、敷衍或明显不感兴趣，请将 suggest_stop 设为 true

                                                                                                          【任务二】生成3条推荐回复
                                                                                                          风格要求：${selectedStyle}
                                                                                                          所有回复必须满足：
                                                                                                          - 自然真实，像真人说的话，不刻意不油腻
                                                                                                          - 简洁，不超过50字
                                                                                                          - 能推进对话，给下一句留出空间
                                                                                                          - 根据对方当前态度调整力度
                                                                                                          - 3条回复的切入角度和节奏各有不同

                                                                                                          ${context ? '【补充背景】' + context : ''}

                                                                                                          请严格用以下JSON格式返回，不要有任何其他文字：
                                                                                                          {
                                                                                                            "attitude_label": "态度标签",
                                                                                                              "attitude_desc": "具体态度分析和策略建议",
                                                                                                                "suggest_stop": false,
                                                                                                                  "replies": [
                                                                                                                      {"tag": "${selectedStyle}", "text": "回复内容1"},
                                                                                                                          {"tag": "${selectedStyle}", "text": "回复内容2"},
                                                                                                                              {"tag": "${selectedStyle}", "text": "回复内容3"}
                                                                                                                                ]
                                                                                                                                }`;

                                                                                                                                  try {
                                                                                                                                      const res = await fetch('/api/analyze', {
                                                                                                                                            method: 'POST',
                                                                                                                                                  headers: { 'Content-Type': 'application/json' },
                                                                                                                                                        body: JSON.stringify({
                                                                                                                                                                model: 'claude-sonnet-4-20250514',
                                                                                                                                                                        max_tokens: 1000,
                                                                                                                                                                                messages: [{
                                                                                                                                                                                          role: 'user',
                                                                                                                                                                                                    content: [
                                                                                                                                                                                                                { type: 'image', source: { type: 'base64', media_type: imageMediaType, data: imageBase64 } },
                                                                                                                                                                                                                            { type: 'text', text: prompt }
                                                                                                                                                                                                                                      ]
                                                                                                                                                                                                                                              }]
                                                                                                                                                                                                                                                    })
                                                                                                                                                                                                                                                        });

                                                                                                                                                                                                                                                            const data = await res.json();
                                                                                                                                                                                                                                                                if (data.error) throw new Error(data.error.message || data.error);

                                                                                                                                                                                                                                                                    const raw = data.content.map(b => b.text || '').join('');
                                                                                                                                                                                                                                                                        const clean = raw.replace(/```json|```/g, '').trim();
                                                                                                                                                                                                                                                                            const parsed = JSON.parse(clean);

                                                                                                                                                                                                                                                                                renderResults(parsed);
                                                                                                                                                                                                                                                                                  } catch (err) {
                                                                                                                                                                                                                                                                                      alert('分析遇到问题，请检查截图后重试。\n错误：' + err.message);
                                                                                                                                                                                                                                                                                          btn.disabled = false;
                                                                                                                                                                                                                                                                                              document.getElementById('btnText').textContent = '重新分析';
                                                                                                                                                                                                                                                                                                }

                                                                                                                                                                                                                                                                                                  document.getElementById('loadingState').style.display = 'none';
                                                                                                                                                                                                                                                                                                    btn.disabled = false;
                                                                                                                                                                                                                                                                                                      document.getElementById('btnText').textContent = '重新分析';
                                                                                                                                                                                                                                                                                                      }

                                                                                                                                                                                                                                                                                                      /* ===== Render Results ===== */
                                                                                                                                                                                                                                                                                                      function renderResults(data) {
                                                                                                                                                                                                                                                                                                        document.getElementById('attitudeBadge').textContent = data.attitude_label;
                                                                                                                                                                                                                                                                                                          document.getElementById('attitudeDesc').textContent = data.attitude_desc;

                                                                                                                                                                                                                                                                                                            const list = document.getElementById('replyList');
                                                                                                                                                                                                                                                                                                              list.innerHTML = '';

                                                                                                                                                                                                                                                                                                                if (data.suggest_stop) {
                                                                                                                                                                                                                                                                                                                    const warn = document.createElement('div');
                                                                                                                                                                                                                                                                                                                        warn.className = 'reply-card';
                                                                                                                                                                                                                                                                                                                            warn.style.cssText = 'border-left: 3px solid #e57373; background: #fff5f5;';
                                                                                                                                                                                                                                                                                                                                warn.innerHTML = '<span class="reply-tag" style="background:#e57373;color:#fff">舔狗预警</span><div class="reply-text">对方态度冷淡，继续追可能适得其反。不如先停下来，给彼此一些空间，让自己更有吸引力。</div>';
                                                                                                                                                                                                                                                                                                                                    list.appendChild(warn);
                                                                                                                                                                                                                                                                                                                                      }

                                                                                                                                                                                                                                                                                                                                        data.replies.forEach((r, i) => {
                                                                                                                                                                                                                                                                                                                                            const card = document.createElement('div');
                                                                                                                                                                                                                                                                                                                                                card.className = 'reply-card';
                                                                                                                                                                                                                                                                                                                                                    card.style.animationDelay = i * 0.08 + 's';
                                                                                                                                                                                                                                                                                                                                                        const cls = TAG_CLASS[r.tag] || 'tag-default';
                                                                                                                                                                                                                                                                                                                                                            card.innerHTML = `<span class="reply-tag ${cls}">${r.tag}</span><div class="reply-text">${r.text}</div><div class="reply-copy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>点击复制</div>`;
                                                                                                                                                                                                                                                                                                                                                                card.addEventListener('click', () => copyText(r.text));
                                                                                                                                                                                                                                                                                                                                                                    list.appendChild(card);
                                                                                                                                                                                                                                                                                                                                                                      });

                                                                                                                                                                                                                                                                                                                                                                        document.getElementById('results').style.display = 'block';
                                                                                                                                                                                                                                                                                                                                                                          document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                                                                                                                                                                                                                                                                                                                                          }

                                                                                                                                                                                                                                                                                                                                                                          /* ===== Copy ===== */
                                                                                                                                                                                                                                                                                                                                                                          function copyText(text) {
                                                                                                                                                                                                                                                                                                                                                                            navigator.clipboard.writeText(text).catch(() => {
                                                                                                                                                                                                                                                                                                                                                                                const ta = document.createElement('textarea');
                                                                                                                                                                                                                                                                                                                                                                                    ta.value = text;
                                                                                                                                                                                                                                                                                                                                                                                        document.body.appendChild(ta);
                                                                                                                                                                                                                                                                                                                                                                                            ta.select();
                                                                                                                                                                                                                                                                                                                                                                                                document.execCommand('copy');
                                                                                                                                                                                                                                                                                                                                                                                                    document.body.removeChild(ta);
                                                                                                                                                                                                                                                                                                                                                                                                      });
                                                                                                                                                                                                                                                                                                                                                                                                        const toast = document.getElementById('toast');
                                                                                                                                                                                                                                                                                                                                                                                                          toast.classList.add('show');
                                                                                                                                                                                                                                                                                                                                                                                                            setTimeout(() => toast.classList.remove('show'), 2200);
                                                                                                                                                                                                                                                                                                                                                                                                            }