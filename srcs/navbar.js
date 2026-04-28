const navigationItems = document.querySelectorAll(
  ".navigation-bar .list-items .item"
);

const navigationPointer = document.querySelector(".navigation-bar .pointer");

function movePointerTo(item) {
  navigationPointer.style.width = `${item.offsetWidth}px`;
  navigationPointer.style.transform = `translateX(${item.offsetLeft}px)`;
}

navigationItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();

    navigationItems.forEach((item) => item.classList.remove("active"));
    item.classList.add("active");

    movePointerTo(item);
  });
});

const activeItem = document.querySelector(".navigation-bar .list-items .item.active");
if (activeItem) {
  movePointerTo(activeItem);
}

window.addEventListener("resize", () => {
  const activeItem = document.querySelector(".navigation-bar .list-items .item.active");
  if (activeItem) {
    movePointerTo(activeItem);
  }
});