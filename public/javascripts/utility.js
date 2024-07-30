const select = (elm) => document.querySelector(elm);
const selectAll = (elms) => document.querySelectorAll(elms);
const copy = (text) => navigator.clipboard.writeText(text);

//handle share as link email input
const shareLink = () => {
    let share = select("#share");
    let shareForm = select(".shareform");
    let shareInp = select(".shareform input");
    let submitBtn = select(".shareform button");
    share?.addEventListener("click", () => {
        // reset form
        shareInp.value = "";
        submitBtn.innerHTML = '<i class="ri-share-forward-fill"></i>';
        submitBtn.type = "submit";
        submitBtn?.removeEventListener("click", copy);

        shareForm.classList.toggle("hidden");
        shareInp.focus();
    });
    shareForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const recipient = shareInp.value;
        const response = await fetch(shareForm.action, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ recipient }),
        });
        const data = await response.json();
        shareInp.value = data.viewLink;
        const submitBtn = shareForm.querySelector("button");
        submitBtn.innerHTML = '<i class="ri-file-copy-line"></i>';
        submitBtn.type = "button"; // Change the button type to button
        submitBtn?.addEventListener("click", () => copy(data.viewLink));
    });
    document.addEventListener("click", (event) => {
        if (
            !shareForm.contains(event.target) &&
            !share.contains(event.target)
        ) {
            shareForm.classList.add("hidden");
        }
    });
};

shareLink();

// handle toggle passcode and can edit enable and disable state
toggleAccess = (check, target) => {
    check?.addEventListener("change", () => {
        !check.checked && target.type === "checkbox"
            ? (target.checked = false)
            : (target.value = "");
        target.disabled = !check.checked;
        target.parentElement.classList.toggle("opacity-40");
    });
};

toggleAccess(select("#encrypt"), select("#passcode"));
toggleAccess(select("#canshare"), select("#canedit"));

const applyFilters = () => {
    const date = select("#date").value;
    const params = new URLSearchParams();

    if (date) {
        params.append("date", date);
    }

    window.location.href = `/filter?${params.toString()}`;
};

select("#date").addEventListener("change", applyFilters);



