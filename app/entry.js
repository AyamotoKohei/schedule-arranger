'use strict';
import $ from 'jquery';

/**
 * 全ての出欠ボタンに対して、クリックすることで出欠状態の更新がWebAPIを通じて実行される
 */
$('.availability-toggle-button').each((i, e) => { // 要素をセレクタで取得
    // ボタン要素のjQueryオブジェクトを取得
    const button = $(e);

    // ボタンがクリックした際の処理を記述
    button.click(() => {
        // jQueryのdata関数を使用して data-* 属性を取得
        const scheduleId = button.data('schedule-id'); // 予定ID
        const userId = button.data('user-id'); // ユーザーID
        const candidateId = button.data('candidate-id'); // 候補ID
        const availability = parseInt(button.data('availability')); // 出席
        const nextAvailability = (availability + 1) % 3; // 0 → 1 → 2 → 0 → 1 → 2 と循環
        // 出欠更新のWebAPIを呼び出しと、実行結果を受け取ってbutton要素の属性を更新し、
        // ボタンのラベルを更新
        $.post(
            `/schedules/${scheduleId}/users/${userId}/candidates/${candidateId}`,
            { availability: nextAvailability },
            data => {
                button.data('availability', data.availability);
                const availabilityLabels = ['欠', '？', '出'];
                button.text(availabilityLabels[data.availability]);
            }
        );
    });
});

const buttonSelfComment = $('#self-comment-button');
buttonSelfComment.click(() => {
    const scheduleId = buttonSelfComment.data('schedule-id');
    const userId = buttonSelfComment.data('user-id');
    const comment = prompt('コメントを255文字以内で入力してください。');
    if (comment) {
        $.post(`/schedules/${scheduleId}/users/${userId}/comments`,
            { comment: comment },
            (data) => {
                $('#self-comment').text(data.comment);
            }
        );
    }
});
