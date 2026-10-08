/* =====================================================
   바이브 카페 주문서 — script.js
   기능 목록:
     1. 탭 전환 (주문하기 / 주문 내역)
     2. 실시간 예상 금액 계산 (calculateTotal)
     3. 주문 접수 및 orders 배열 저장
     4. 주문 내역 화면 렌더링 (renderOrders)
     5. 주문 취소 (개별 삭제)
     6. 내역 모두 지우기
     7. 다시 작성 (폼 초기화 — 주문 내역은 유지)
     8. Supabase 연동 — cafe_menu03 테이블에 주문 저장
   ===================================================== */


/* ─────────────────────────────────────────────────────
   0. Supabase 초기화
   ─────────────────────────────────────────────────────
   아래 두 값을 Supabase 대시보드 > Project Settings > API 에서 복사해서 넣으세요.
   - SUPABASE_URL : Project URL (https://xxxx.supabase.co)
   - SUPABASE_KEY : anon public key
   ───────────────────────────────────────────────────── */

/* ▼▼▼ 여기에 본인의 Supabase URL과 anon key를 직접 입력하세요 ▼▼▼ */
var SUPABASE_URL = 'https://twfqtpzwnfqjqurxfetl.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3ZnF0cHp3bmZxanF1cnhmZXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTU5NDksImV4cCI6MjEwNjk3MTk0OX0.eq8IGUYKFhQnIuiZ6epuy4mEpIc0tPq4gNEc5LLTDys';
/* ▲▲▲ 입력 완료 후 저장하면 연동됩니다 ▲▲▲ */

/* Supabase 클라이언트 생성
   supabase.createClient()는 index.html에서 CDN으로 불러온 supabase-js가 제공 */
var supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


/* ─────────────────────────────────────────────────────
   1. DOM 요소 가져오기
   ───────────────────────────────────────────────────── */

/* 탭 관련 */
var tabBtns        = document.querySelectorAll('.tab-btn');       // 탭 버튼 2개
var tabPanels      = document.querySelectorAll('.tab-panel');     // 탭 패널 2개
var orderBadge     = document.getElementById('order-badge');      // 주문 건수 배지

/* 주문 폼 입력 요소 */
var customerNameInput = document.getElementById('customer-name');
var drinkSelect       = document.getElementById('drink-select');
var quantityInput     = document.getElementById('quantity');
var requestTextarea   = document.getElementById('request');
var sizeRadios        = document.querySelectorAll('input[name="size"]');
var optionCheckboxes  = document.querySelectorAll('input[name="options"]');

/* 예상 금액 표시 */
var estimatedPriceSpan = document.getElementById('estimated-price');

/* 폼 & 버튼 */
var orderForm    = document.getElementById('order-form');
var resetBtn     = document.getElementById('reset-btn');

/* 주문 확인 메시지 */
var confirmationDiv = document.getElementById('order-confirmation');

/* 주문 내역 탭 요소 */
var orderList    = document.getElementById('order-list');         // 카드 목록 컨테이너
var orderSummary = document.getElementById('order-summary');      // 합계 + 전체삭제 영역
var summaryText  = document.getElementById('summary-text');       // 합계 텍스트
var clearAllBtn  = document.getElementById('clear-all-btn');      // 내역 모두 지우기 버튼


/* ─────────────────────────────────────────────────────
   2. 주문 데이터 저장소
   ───────────────────────────────────────────────────── */

/* orders: 접수된 주문 객체를 담는 배열 */
var orders = [];

/* orderCount: 주문 번호 카운터 (취소해도 번호는 계속 증가) */
var orderCount = 0;


/* ─────────────────────────────────────────────────────
   3. 탭 전환 기능
   ───────────────────────────────────────────────────── */

/* 탭 버튼 각각에 클릭 이벤트 등록 */
tabBtns.forEach(function (btn) {
  btn.addEventListener('click', function () {
    /* 클릭한 버튼의 data-tab 속성값을 읽음 ("order" 또는 "history") */
    var targetTab = btn.dataset.tab;

    /* 모든 탭 버튼에서 active 클래스 제거 */
    tabBtns.forEach(function (b) {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });

    /* 모든 탭 패널 숨기기 */
    tabPanels.forEach(function (panel) {
      panel.classList.add('hidden');
    });

    /* 클릭한 탭 버튼 활성화 */
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    /* 해당 패널 보이기 */
    var targetPanel = document.getElementById('tab-' + targetTab);
    targetPanel.classList.remove('hidden');
  });
});


/* ─────────────────────────────────────────────────────
   4. calculateTotal() — 예상 금액 계산 함수
   (모든 금액 계산을 여기서 처리하고 재사용)

   계산 공식:
   총액 = (음료 가격 + 사이즈 추가금 + 선택 옵션 합계) × 수량
   ───────────────────────────────────────────────────── */
function calculateTotal() {
  /* 음료 가격: 선택된 option의 data-price */
  var selectedOption = drinkSelect.options[drinkSelect.selectedIndex];
  var drinkPrice = Number(selectedOption.dataset.price); // 미선택 시 0

  /* 사이즈 추가금: checked 된 라디오의 data-price */
  var sizePrice = 0;
  sizeRadios.forEach(function (radio) {
    if (radio.checked) {
      sizePrice = Number(radio.dataset.price);
    }
  });

  /* 옵션 합계: checked 된 체크박스 data-price 모두 더하기 */
  var optionsPrice = 0;
  optionCheckboxes.forEach(function (checkbox) {
    if (checkbox.checked) {
      optionsPrice += Number(checkbox.dataset.price);
    }
  });

  /* 수량: 정수로 변환, 이상한 값이면 1 */
  var quantity = parseInt(quantityInput.value, 10) || 1;

  /* 최종 계산 */
  var total = (drinkPrice + sizePrice + optionsPrice) * quantity;

  /* 화면에 표시 (toLocaleString으로 천 단위 콤마) */
  estimatedPriceSpan.textContent = total.toLocaleString();

  /* 호출한 곳에서 재사용할 수 있도록 반환 */
  return total;
}


/* ─────────────────────────────────────────────────────
   5. 실시간 금액 업데이트 — 이벤트 리스너 등록
   ───────────────────────────────────────────────────── */
drinkSelect.addEventListener('change', calculateTotal);
quantityInput.addEventListener('input', calculateTotal);
sizeRadios.forEach(function (radio) {
  radio.addEventListener('change', calculateTotal);
});
optionCheckboxes.forEach(function (checkbox) {
  checkbox.addEventListener('change', calculateTotal);
});


/* ─────────────────────────────────────────────────────
   6. 주문하기 — 폼 제출 이벤트 (Supabase 저장 포함)
   ─────────────────────────────────────────────────────
   async 함수: await로 Supabase 응답을 기다린 뒤 성공/실패 처리
   ───────────────────────────────────────────────────── */
orderForm.addEventListener('submit', async function (event) {
  /* 브라우저 기본 페이지 이동 방지 */
  event.preventDefault();

  /* ── 유효성 검사: 이름 ── */
  var name = customerNameInput.value.trim();
  if (name === '') {
    alert('이름을 입력해주세요.');
    customerNameInput.focus();
    return;
  }

  /* ── 유효성 검사: 음료 선택 ── */
  if (drinkSelect.value === '') {
    alert('음료를 선택해주세요.');
    drinkSelect.focus();
    return;
  }

  /* ── 주문 정보 수집 ── */

  /* 전화번호 (없으면 빈 문자열) */
  var phone = document.getElementById('phone-number').value.trim();

  /* 음료 이름: option 텍스트에서 첫 단어만 (예: "카페라떼 4,000원" → "카페라떼") */
  var selectedDrinkOption = drinkSelect.options[drinkSelect.selectedIndex];
  var drinkName  = selectedDrinkOption.text.split(' ')[0];
  /* 음료 단가: data-price 속성에서 읽기 (Supabase drink_price 열에 저장) */
  var drinkPrice = Number(selectedDrinkOption.dataset.price);

  /* 선택된 사이즈 값 대문자로 (예: "m" → "M") */
  var selectedSizeLabel = '';
  sizeRadios.forEach(function (radio) {
    if (radio.checked) {
      selectedSizeLabel = radio.value.toUpperCase();
    }
  });

  /* 체크된 옵션 이름 목록 수집
     각 label에서 .price-tag 텍스트를 제거하고 이름만 추출 */
  var selectedOptionNames = [];
  optionCheckboxes.forEach(function (checkbox) {
    if (checkbox.checked) {
      var label    = document.querySelector('label[for="' + checkbox.id + '"]');
      var priceTag = label.querySelector('.price-tag');
      var optName  = label.textContent.replace(priceTag.textContent, '').trim();
      selectedOptionNames.push(optName);
    }
  });

  /* 수량 */
  var quantity = parseInt(quantityInput.value, 10) || 1;

  /* 요청사항 (공백 제거) */
  var requestText = requestTextarea.value.trim();

  /* 총 금액 (calculateTotal 재사용) */
  var total = calculateTotal();

  /* 주문 시간 */
  var now       = new Date();
  var orderTime = now.toLocaleTimeString('ko-KR', {
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  /* ── Supabase에 저장할 데이터 객체 ── */
  var orderData = {
    customer_name: name,
    phone:         phone,
    drink:         drinkName,
    drink_price:   drinkPrice,
    size:          selectedSizeLabel,
    options:       selectedOptionNames,   // TEXT[] 배열 그대로 전달
    quantity:      quantity,
    request:       requestText,
    total_price:   total
  };

  /* ── 주문하기 버튼 비활성화 (저장 중 두 번 눌림 방지) ── */
  var submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = '저장 중...';

  /* ── Supabase INSERT 요청 ── */
  /* await: 저장이 완료될 때까지 기다렸다가 결과를 받음 */
  var result = await supabaseClient
    .from('cafe_menu03')    // 테이블 이름
    .insert([orderData]);   // 배열로 감싸서 삽입

  /* result.error: 실패했을 때 에러 객체가 들어옴, 성공하면 null */
  if (result.error) {
    /* 저장 실패 */
    console.error('Supabase 저장 에러:', result.error); // 개발자 도구에서 확인
    alert('주문 저장에 실패했어요. 다시 시도해주세요.');

    /* 버튼 원상복구 (다시 누를 수 있게) */
    submitBtn.disabled = false;
    submitBtn.textContent = '주문하기';
    return; // 아래 성공 처리 코드는 실행하지 않음
  }

  /* ── 저장 성공 ── */

  /* 버튼 원상복구 */
  submitBtn.disabled = false;
  submitBtn.textContent = '주문하기';

  /* 로컬 orders 배열에도 추가 (주문 내역 탭에 표시) */
  orderCount += 1;
  var newOrder = {
    id:       orderCount,
    name:     name,
    drink:    drinkName,
    size:     selectedSizeLabel,
    options:  selectedOptionNames,
    quantity: quantity,
    request:  requestText,
    total:    total,
    time:     orderTime
  };
  orders.unshift(newOrder); // 최신 주문이 맨 위

  /* ── 주문 확인 메시지 표시 ── */
  var optionText = selectedOptionNames.length > 0
    ? ' (' + selectedOptionNames.join(', ') + ')'
    : '';

  var message =
    name + '님, ' +
    drinkName + ' ' + selectedSizeLabel + '사이즈' + optionText + ' ' +
    quantity + '잔, 총 ' + total.toLocaleString() + '원 주문이 접수되었습니다! ☕';

  /* 보안: 사용자 입력이므로 textContent 사용 (innerHTML 사용 금지) */
  confirmationDiv.textContent = message;
  confirmationDiv.removeAttribute('hidden');
  confirmationDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

  /* ── 주문 내역 탭 갱신 ── */
  renderOrders();
});



/* ─────────────────────────────────────────────────────
   7. renderOrders() — 주문 내역 목록 그리기 함수
   orders 배열을 읽어 카드를 DOM에 생성
   ───────────────────────────────────────────────────── */
function renderOrders() {
  /* 기존 카드 목록 전부 지우기 */
  orderList.textContent = '';

  /* 배지 숫자 업데이트 */
  orderBadge.textContent = orders.length;

  /* 주문이 없으면 안내 문구 표시 후 합계 영역 숨기기 */
  if (orders.length === 0) {
    var emptyMsg = document.createElement('p');
    emptyMsg.className = 'order-empty';
    emptyMsg.textContent = '아직 주문 내역이 없어요 ☕';
    orderList.appendChild(emptyMsg);

    orderBadge.classList.add('hidden');   // 배지 숨기기
    orderSummary.classList.add('hidden'); // 합계 영역 숨기기
    return; // 더 이상 실행 안 함
  }

  /* 주문이 있으면 배지 표시 */
  orderBadge.classList.remove('hidden');

  /* ── 주문 카드 생성 (orders 배열 순서대로 = 최신순) ── */
  orders.forEach(function (order) {

    /* 카드 컨테이너 */
    var card = document.createElement('div');
    card.className = 'order-card';
    /* 나중에 취소 버튼이 이 카드의 주문 id를 알 수 있도록 data 속성 저장 */
    card.dataset.orderId = order.id;

    /* ── 취소 버튼 (카드 오른쪽 위) ── */
    var cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.type = 'button';
    cancelBtn.textContent = '취소';
    /* 클릭 이벤트: 해당 주문 id를 삭제 */
    cancelBtn.addEventListener('click', function () {
      cancelOrder(order.id);
    });

    /* ── 1줄: "#1 홍길동님 · 5,000원" ── */
    var titleEl = document.createElement('p');
    titleEl.className = 'order-card-title';
    /* 보안: 사용자 이름이 포함되므로 textContent 사용 */
    titleEl.textContent =
      '#' + order.id + ' ' + order.name + '님 · ' + order.total.toLocaleString() + '원';

    /* ── 2줄: "카페라떼 M사이즈 (샷 추가) 1잔" ── */
    var detailEl = document.createElement('p');
    detailEl.className = 'order-card-detail';
    var optionPart = order.options.length > 0
      ? ' (' + order.options.join(', ') + ')'
      : '';
    /* 보안: 음료명/옵션 모두 textContent */
    detailEl.textContent =
      order.drink + ' ' + order.size + '사이즈' + optionPart + ' ' + order.quantity + '잔';

    /* ── 3줄: 요청사항(있을 때만) + 주문 시간 ── */
    var metaEl = document.createElement('p');
    metaEl.className = 'order-card-meta';

    /* 요청사항이 있을 때만 앞에 추가 */
    if (order.request !== '') {
      /* 보안: 사용자 입력이므로 textContent */
      var requestLine = document.createElement('span');
      requestLine.textContent = '📝 ' + order.request;
      metaEl.appendChild(requestLine);
      metaEl.appendChild(document.createElement('br'));
    }

    var timeLine = document.createElement('span');
    timeLine.textContent = '🕐 ' + order.time;
    metaEl.appendChild(timeLine);

    /* ── 카드에 자식 요소 추가 ── */
    card.appendChild(cancelBtn);
    card.appendChild(titleEl);
    card.appendChild(detailEl);
    card.appendChild(metaEl);

    /* 카드를 목록 컨테이너에 추가 */
    orderList.appendChild(card);
  });

  /* ── 합계 계산 및 합계 영역 표시 ── */
  var grandTotal = orders.reduce(function (sum, o) {
    return sum + o.total; // 모든 주문 금액 합산
  }, 0);

  /* 보안: 금액/건수는 숫자이므로 textContent 안전 */
  summaryText.textContent =
    '총 주문 금액: ' + grandTotal.toLocaleString() + '원 (' + orders.length + '건)';

  orderSummary.classList.remove('hidden'); // 합계 영역 표시
}


/* ─────────────────────────────────────────────────────
   8. cancelOrder(id) — 주문 1건 취소 (삭제)
   ───────────────────────────────────────────────────── */
function cancelOrder(id) {
  /* confirm으로 한 번 더 확인 */
  var ok = confirm('주문을 취소할까요?');
  if (!ok) return; // 취소 누르면 아무 일도 안 함

  /* orders 배열에서 해당 id의 주문 제거
     filter: id가 다른 것만 남김 */
  orders = orders.filter(function (order) {
    return order.id !== id;
  });

  /* 목록 다시 그리기 */
  renderOrders();
}


/* ─────────────────────────────────────────────────────
   9. 내역 모두 지우기 버튼
   ───────────────────────────────────────────────────── */
clearAllBtn.addEventListener('click', function () {
  var ok = confirm('주문 내역을 모두 지울까요?');
  if (!ok) return;

  orders = [];      // 배열 비우기
  orderCount = 0;   // 번호 카운터도 초기화
  renderOrders();   // 빈 상태로 다시 그리기
});


/* ─────────────────────────────────────────────────────
   10. 다시 작성 버튼 — 폼만 초기화 (주문 내역 유지)
   ───────────────────────────────────────────────────── */
resetBtn.addEventListener('click', function () {
  /* 주문 확인 메시지 숨기기 */
  confirmationDiv.setAttribute('hidden', '');
  confirmationDiv.textContent = '';

  /* 예상 금액 0원으로 초기화 */
  estimatedPriceSpan.textContent = '0';

  /* 이름 칸으로 포커스 이동 */
  customerNameInput.focus();

  /* ※ 주문 내역(orders 배열)은 건드리지 않음 */
});


/* ─────────────────────────────────────────────────────
   11. 페이지 최초 로드 시 초기화
   ───────────────────────────────────────────────────── */
/* 예상 금액 0원 표시 */
estimatedPriceSpan.textContent = '0';

/* 주문 내역 탭 초기 상태 그리기 (빈 상태) */
renderOrders();
