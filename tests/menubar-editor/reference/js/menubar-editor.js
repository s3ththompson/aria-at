/*
*   This content is licensed according to the W3C Software License at
*   https://www.w3.org/Consortium/Legal/2015/copyright-software-and-document
*
*   File:   menubar-editor.js
*
*   Desc:   Creates a menubar to control the styling of text in a textarea element
*/

var MenubarEditor = function (domNode, actionManager) {

  this.domNode = domNode;
  this.actionManager = actionManager;

  this.menuitemGroups = {};
  this.menuOrientation = {};
  this.isPopup = {};
  this.openPopups = false;

  this.firstChars = {}; // see Menubar init method
  this.firstMenuitem = {}; // see Menubar init method
  this.lastMenuitem = {}; // see Menubar init method

  this.initMenu(domNode)
  domNode.addEventListener('focusin', this.handleMenubarFocusin.bind(this));
  domNode.addEventListener('focusout', this.handleMenubarFocusout.bind(this));

  window.addEventListener('mousedown', this.handleBackgroundMousedown.bind(this), true);
};

MenubarEditor.prototype.getMenuitems = function(domNode) {
  var nodes = [];

  var initMenu = this.initMenu.bind(this);
  var getGroupId = this.getGroupId.bind(this);
  var menuitemGroups = this.menuitemGroups;

  function findMenuitems(node, group) {
    var role, flag, groupId;

    while (node) {
      flag = true;
      role = node.getAttribute('role');

      if (role) {
        role = role.trim().toLowerCase();
      }

      switch (role) {
        case 'menu':
          node.tabIndex = -1;
          initMenu(node);
          flag = false;
          break;

        case 'group':
          groupId = getGroupId(node);
          menuitemGroups[groupId] = [];
          break;

        case 'menuitem':
        case 'menuitemradio':
        case 'menuitemcheckbox':
          nodes.push(node);
          if (group) {
            group.push(node);
          }
          break;

        default:
          break;
      }

      if (flag && node.firstElementChild) {
        findMenuitems(node.firstElementChild, menuitemGroups[groupId]);
      }

      node = node.nextElementSibling;
    }
  }

  findMenuitems(domNode.firstElementChild, false);

  return nodes;
};

MenubarEditor.prototype.initMenu = function (menu) {
  var i, menuitems, menuitem, role, nextElement;

  var menuId = this.getMenuId(menu);

  menuitems = this.getMenuitems(menu);
  this.menuOrientation[menuId] = this.getMenuOrientation(menu);
  this.isPopup[menuId] = menu.getAttribute('role') === 'menu';

  this.menuitemGroups[menuId] = [];
  this.firstChars[menuId] = [];
  this.firstMenuitem[menuId] = null;
  this.lastMenuitem[menuId] = null;

  for(i = 0; i < menuitems.length; i++) {
    menuitem = menuitems[i];
    role = menuitem.getAttribute('role');

    if (role.indexOf('menuitem') < 0) {
      continue;
    }

    menuitem.tabIndex = -1;
    this.menuitemGroups[menuId].push(menuitem);
    this.firstChars[menuId].push(menuitem.textContent[0].toLowerCase());

    menuitem.addEventListener('keydown', this.handleKeydown.bind(this));
    menuitem.addEventListener('click', this.handleMenuitemClick.bind(this));
    menuitem.addEventListener('mouseover', this.handleMenuitemMouseover.bind(this));

    if( !this.firstMenuitem[menuId]) {
      if (this.hasPopup(menuitem)) {
        menuitem.tabIndex = 0;
      }
      this.firstMenuitem[menuId] = menuitem;
    }
    this.lastMenuitem[menuId] = menuitem;

  }
};

/* MenubarEditor FOCUS MANAGEMENT METHODS */

MenubarEditor.prototype.setFocusToMenuitem = function (menuId, newMenuitem, currentMenuitem) {

  if (typeof currentMenuitem !== 'object') {
    currentMenuitem = false;
  }

  if (currentMenuitem &&
      this.hasPopup(currentMenuitem) &&
      this.isOpen(currentMenuitem)) {
    this.closePopup(currentMenuitem);
  }

  if (this.hasPopup(newMenuitem)) {
    if (this.openPopups) {
      this.openPopup(newMenuitem);
    }
  }
  else {
    var menu = this.getMenu(newMenuitem);
    var cmi = menu.previousElementSibling;
    if (!this.isOpen(cmi)) {
      this.openPopup(cmi);
    }
  }

  if (this.hasPopup(newMenuitem)) {
    this.menuitemGroups[menuId].forEach(function(item) {
      item.tabIndex = -1;
    });

    newMenuitem.tabIndex = 0;
  }

  newMenuitem.focus();

};

MenubarEditor.prototype.setFocusToFirstMenuitem = function (menuId,  currentMenuitem) {
  this.setFocusToMenuitem(menuId, this.firstMenuitem[menuId],  currentMenuitem);
};

MenubarEditor.prototype.setFocusToLastMenuitem = function (menuId,  currentMenuitem) {
  this.setFocusToMenuitem(menuId, this.lastMenuitem[menuId],  currentMenuitem);
};

MenubarEditor.prototype.setFocusToPreviousMenuitem = function (menuId, currentMenuitem) {
  var newMenuitem, index;

  if (currentMenuitem === this.firstMenuitem[menuId]) {
    newMenuitem = this.lastMenuitem[menuId];
  }
  else {
    index = this.menuitemGroups[menuId].indexOf(currentMenuitem);
    newMenuitem = this.menuitemGroups[menuId][ index - 1 ];
  }

  this.setFocusToMenuitem(menuId, newMenuitem, currentMenuitem);

  return newMenuitem;
};

MenubarEditor.prototype.setFocusToNextMenuitem = function (menuId, currentMenuitem) {
  var newMenuitem, index;

  if (currentMenuitem === this.lastMenuitem[menuId]) {
    newMenuitem = this.firstMenuitem[menuId];
  }
  else {
    index = this.menuitemGroups[menuId].indexOf(currentMenuitem);
    newMenuitem = this.menuitemGroups[menuId][ index + 1 ];
  }
  this.setFocusToMenuitem(menuId, newMenuitem, currentMenuitem);

  return newMenuitem;
};

MenubarEditor.prototype.setFocusByFirstCharacter = function (menuId, currentMenuitem, char) {
  var start, index;

  char = char.toLowerCase();

  // Get start index for search based on position of currentItem
  start = this.menuitemGroups[menuId].indexOf(currentMenuitem) + 1;
  if (start >=  this.menuitemGroups[menuId].length) {
    start = 0;
  }

  // Check remaining slots in the menu
  index = this.getIndexFirstChars(menuId, start, char);

  // If not found in remaining slots, check from beginning
  if (index === -1) {
    index = this.getIndexFirstChars(menuId, 0, char);
  }

  // If match was found...
  if (index > -1) {
    this.setFocusToMenuitem(menuId, this.menuitemGroups[menuId][index], currentMenuitem);
  }
};

// Utitlities

MenubarEditor.prototype.getIndexFirstChars = function (menuId, startIndex, char) {
  for (var i = startIndex; i < this.firstChars[menuId].length; i++) {
    if (char === this.firstChars[menuId][i]) {
      return i;
    }
  }
  return -1;
};

MenubarEditor.prototype.isPrintableCharacter = function(str) {
    return str.length === 1 && str.match(/\S/);
};

MenubarEditor.prototype.getIdFromAriaLabel = function(node) {
  var id = node.getAttribute('aria-label')
  if (id) {
    id = id.trim().toLowerCase().replace(' ', '-').replace('/', '-');
  }
  return id;
};


MenubarEditor.prototype.getMenuOrientation = function(node) {

  var orientation = node.getAttribute('aria-orientation');

  if (!orientation) {
    var role = node.getAttribute('role');

    switch (role) {
      case 'menubar':
        orientation = 'horizontal';
        break;

      case 'menu':
        orientation = 'vertical';
        break;

      default:
        break;
    }
  }

  return orientation;
};

MenubarEditor.prototype.getDataOption = function(node) {

  var option = false;
  var hasOption = node.hasAttribute('data-option');
  var role = node.hasAttribute('role');

  if (!hasOption) {

    while (node && !hasOption &&
         (role !== 'menu') &&
         (role !== 'menubar')) {
      node = node.parentNode;
      if (node) {
        role = node.getAttribute('role');
        hasOption = node.hasAttribute('data-option');
      }
    }
  }

  if (node) {
    option = node.getAttribute('data-option');
  }

  return option;
};

MenubarEditor.prototype.getGroupId = function(node) {

  var id = false;
  var role = node.getAttribute('role');

  while (node && (role !== 'group') &&
         (role !== 'menu') &&
         (role !== 'menubar')) {
    node = node.parentNode;
    if (node) {
      role = node.getAttribute('role');
    }
 }

  if (node) {
    id = role + '-' + this.getIdFromAriaLabel(node);
  }

  return id;
};

MenubarEditor.prototype.getMenuId = function(node) {

  var id = false;
  var role = node.getAttribute('role');

  while (node && (role !== 'menu') && (role !== 'menubar')) {
    node = node.parentNode;
    if (node) {
      role = node.getAttribute('role');
    }
  }

  if (node) {
    id = role + '-' + this.getIdFromAriaLabel(node);
  }

  return id;
};

MenubarEditor.prototype.getMenu = function(menuitem) {

  var id = false;
  var menu = menuitem;
  var role = menuitem.getAttribute('role');

  while (menu && (role !== 'menu') && (role !== 'menubar')) {
    menu = menu.parentNode
    if (menu) {
      role = menu.getAttribute('role');
    }
  }

  return menu;
};

MenubarEditor.prototype.toggleCheckbox = function(menuitem) {
  if (menuitem.getAttribute('aria-checked') === 'true') {
    menuitem.setAttribute('aria-checked', 'false');
    return false;
  }
  menuitem.setAttribute('aria-checked', 'true');
  return true;
};

MenubarEditor.prototype.setRadioButton = function(menuitem) {
  var groupId = this.getGroupId(menuitem);
  var radiogroupItems = this.menuitemGroups[groupId];
  radiogroupItems.forEach( function (item) {
    item.setAttribute('aria-checked', 'false')
  });
  menuitem.setAttribute('aria-checked', 'true');
  return menuitem.textContent;
};

MenubarEditor.prototype.updateFontSizeMenu = function(menuId) {

  var fontSizeMenuitems = this.menuitemGroups[menuId];
  var currentValue = this.actionManager.getFontSize();

  for (var i = 0; i < fontSizeMenuitems.length; i++) {
    var mi = fontSizeMenuitems[i];
    var dataOption = mi.getAttribute('data-option');
    var value = mi.textContent.trim().toLowerCase();

    switch (dataOption) {
      case 'font-smaller':
        if (currentValue === 'x-small') {
          mi.setAttribute('aria-disabled', 'true');
        }
        else {
          mi.removeAttribute('aria-disabled');
        }
        break;

      case 'font-larger':
        if (currentValue === 'x-large') {
          mi.setAttribute('aria-disabled', 'true');
        }
        else {
          mi.removeAttribute('aria-disabled');
        }
        break;

      default:
        if (currentValue === value) {
          mi.setAttribute('aria-checked', 'true');
        }
        else {
          mi.setAttribute('aria-checked', 'false');
        }
        break;

    }
  }


}

// Popup menu methods

MenubarEditor.prototype.openPopup = function (menuitem) {

  // set aria-expanded attribute
  var popupMenu = menuitem.nextElementSibling;

  var rect = menuitem.getBoundingClientRect();

  // set CSS properties
  popupMenu.style.position = 'absolute';
  popupMenu.style.top = (rect.height + 1) + 'px';
  popupMenu.style.left = '0px';
  popupMenu.style.zIndex = 100;
  popupMenu.style.display = 'block';

  menuitem.setAttribute('aria-expanded', 'true');

  return this.getMenuId(popupMenu);

};

MenubarEditor.prototype.closePopup = function (menuitem) {
  var menu, cmi;

  if (this.hasPopup(menuitem)) {
    if (this.isOpen(menuitem)) {
      menuitem.setAttribute('aria-expanded', 'false');
      menuitem.nextElementSibling.style.display = 'none';
      menuitem.nextElementSibling.style.zIndex = 0;

    }
  }
  else {
    menu = this.getMenu(menuitem);
    cmi = menu.previousElementSibling;
    cmi.setAttribute('aria-expanded', 'false');
    cmi.focus();
    menu.style.display = 'none';
    menu.style.zIndex = 0;
  }
  return cmi;
};

MenubarEditor.prototype.closePopupAll = function () {

  var popups = this.domNode.querySelectorAll('[aria-haspopup]');

  for (var i = 0; i < popups.length; i++) {
    var popup = popups[i];
    if (this.isOpen(popup)) {
      this.closePopup(popup);
      event.stopPropagation();
      event.preventDefault();
    }
  }

};

MenubarEditor.prototype.hasPopup = function (menuitem) {
  return menuitem.getAttribute('aria-haspopup') === 'true';
};

MenubarEditor.prototype.isOpen = function (menuitem) {
  return menuitem.getAttribute('aria-expanded') === 'true';
};

// Menu event handlers

MenubarEditor.prototype.handleMenubarFocusin = function (event) {
  // if the menubar or any of its menus has focus, add styling hook for hover
  this.domNode.classList.add('focus');
};

MenubarEditor.prototype.handleMenubarFocusout = function (event) {
  // remove styling hook for hover on menubar item
  this.domNode.classList.remove('focus');
};

MenubarEditor.prototype.handleBackgroundMousedown = function (event) {
  if (!this.domNode.contains(event.target)) {
    this.closePopupAll();
  }
};

MenubarEditor.prototype.handleKeydown = function (event) {
  var tgt = event.currentTarget,
    key = event.key,
    flag = false,
    menuId = this.getMenuId(tgt),
    id,
    popupMenuId,
    mi,
    role,
    option,
    value;

  console.log('[handleMenubarKeydown][key]: ' + key);
  console.log('[handleMenubarKeydown][menuId]: ' + menuId);

  // This fixes a problem with regression tests using Key.SPACE
  if (event.keyCode === 32) {
    key = ' ';
  }

  switch (key) {
    case ' ':
    case 'Enter':
     if (this.hasPopup(tgt)) {
        this.openPopups = true;
        popupMenuId = this.openPopup(tgt);
        this.setFocusToFirstMenuitem(popupMenuId);
      }
      else {
        role = tgt.getAttribute('role');
        option = this.getDataOption(tgt);
        switch(role) {
          case 'menuitem':
            this.actionManager.setOption(option, tgt.textContent);
            break;

          case 'menuitemcheckbox':
            value = this.toggleCheckbox(tgt);
            this.actionManager.setOption(option, value);
            break;

          case 'menuitemradio':
            value = this.setRadioButton(tgt);
            this.actionManager.setOption(option, value);
            break;

          default:
            break;
        }

        if (this.getMenuId(tgt) === 'menu-size') {
          this.updateFontSizeMenu('menu-size');
        }
        this.openPopups = false;
        this.closePopup(tgt);
      }
      flag = true;
     break;

    case 'ArrowDown':
    case 'Down':
      if (this.menuOrientation[menuId] === 'vertical') {
        this.setFocusToNextMenuitem(menuId, tgt);
        flag = true;
      }
      else {
        if (this.hasPopup(tgt)) {
          this.openPopups = true;
          popupMenuId = this.openPopup(tgt);
          this.setFocusToFirstMenuitem(popupMenuId);
          flag = true;
        }
      }
      break;

    case 'Esc':
    case 'Escape':
        this.openPopups = false;
        this.closePopup(tgt);
        flag = true;
      break;

    case 'Left':
    case 'ArrowLeft':
      if (this.menuOrientation[menuId] === 'horizontal') {
        this.setFocusToPreviousMenuitem(menuId, tgt);
        flag = true;
      }
      else {
        mi = this.closePopup(tgt);
        id = this.getMenuId(mi);
        mi = this.setFocusToPreviousMenuitem(id, mi);
        this.openPopup(mi);
      }
      break;

    case 'Right':
    case 'ArrowRight':
      if (this.menuOrientation[menuId] === 'horizontal') {
        this.setFocusToNextMenuitem(menuId, tgt);
        flag = true;
      }
      else {
        mi = this.closePopup(tgt);
        id = this.getMenuId(mi);
        mi = this.setFocusToNextMenuitem(id, mi);
        this.openPopup(mi);
      }
      break;

    case 'Up':
    case 'ArrowUp':
      if (this.menuOrientation[menuId] === 'vertical') {
        this.setFocusToPreviousMenuitem(menuId, tgt);
        flag = true;
      }
      else {
        if (this.hasPopup(tgt)) {
          this.openPopups = true;
          popupMenuId = this.openPopup(tgt);
          this.setFocusToLastMenuitem(popupMenuId);
          flag = true;
        }
      }
      break;

    case 'Home':
    case 'PageUp':
      this.setFocusToFirstMenuitem(menuId, tgt);
      flag = true;
      break;

    case 'End':
    case 'PageDown':
      this.setFocusToLastMenuitem(menuId, tgt);
      flag = true;
      break;

    case 'Tab':
      this.openPopups = false;
      this.closePopup(tgt);
      break;

    default:
      if (this.isPrintableCharacter(key)) {
        this.setFocusByFirstCharacter(menuId, tgt, key);
        flag = true;
      }
      break;
  }

  if (flag) {
    event.stopPropagation();
    event.preventDefault();
  }
};

MenubarEditor.prototype.handleMenuitemClick = function (event) {
  var tgt = event.currentTarget,
  role,
  option,
  value;

  if (this.hasPopup(tgt)) {
    if (this.isOpen(tgt)) {
      this.openPopups = false;
      this.closePopup(tgt);
    }
    else {
      this.closePopupAll();
      this.openPopups = true;
      this.openPopup(tgt);
    }
  }
  else {
    role = tgt.getAttribute('role');
    option = this.getDataOption(tgt);
    switch(role) {
      case 'menuitem':
        this.actionManager.setOption(option, tgt.textContent);
        break;

      case 'menuitemcheckbox':
        value = this.toggleCheckbox(tgt);
        this.actionManager.setOption(option, value);
        break;

      case 'menuitemradio':
        value = this.setRadioButton(tgt);
        this.actionManager.setOption(option, value);
        break;

      default:
        break;
    }

    if (this.getMenuId(tgt) === 'menu-size') {
      this.updateFontSizeMenu('menu-size');
    }
    this.openPopups = false;
    this.closePopup(tgt);
  }

  event.stopPropagation();
  event.preventDefault();

};

MenubarEditor.prototype.handleMenuitemMouseover = function (event) {
  var tgt = event.currentTarget;

  if (this.hasPopup(tgt) && this.openPopups) {
    if (!this.isOpen(tgt)) {
      this.closePopupAll();
      this.openPopups = true;
      this.openPopup(tgt);
    }
  }
};

// Initialize menubar editor

window.addEventListener('load', function () {
  var styleManager  = new StyleManager('textarea1');
  document.menubarEditor = new MenubarEditor(document.getElementById('menubar1'), styleManager);
});

