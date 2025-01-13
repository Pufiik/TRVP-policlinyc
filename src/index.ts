interface IInfoRow {
    name: string;
    values?: string | string[];
    className: string;
}

interface IInputOptions {
    uuid?: string;
    classes: string[];
    label: string;
    labelName: string;
    type: string;
}

interface IRow {
    id: string;
    value: string;
}

interface ISelectOptions {
    uuid?: string;
    classes: string[];
    label: string;
    labelName: string;
    mainOption?: string;
    multiple?: boolean;
    query?: IQueryOptions;
    values?: string | string[];
}

interface IQueryOptions {
    url: string;
    method: string;
    body?: object;
    query?: Record<string, any>;
}

interface IEntry {
    id: string;
    fio: string;
    procedure: string;
    hardness: string;
}

type IItemOptions = IEntry;

interface ICard {
    id: string;
    date: string;
    procedures: string[];
    entries: string[];
}

function toggleModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        if (modal.classList.toggle('hidden')) {
            const content = modal.querySelector('.content');
            content!.innerHTML = '';

            const approveBtn = modal.querySelector('#approve');
            approveBtn!.remove();
        }
    }
}

async function query(url: string, method: string, body?: object, query?: Record<string, any>) {
    const request = await fetch(url + (query ? `?${new URLSearchParams(query).toString()}` : ''), {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!request.ok) {
        throw new Error(await request.text());
    }
    return request
}

function validateString(str: string | undefined) {
    return str && str.length > 0;
}

function addRow(element: Element, options: IInfoRow) {
    element.classList.add(options.className);

    let p = element.appendChild(document.createElement('p'));
    p.innerText = options.name;
    p.classList.add('title');

    p = element.appendChild(document.createElement('p'));
    if (typeof options.values === 'string') {
        p.innerText = options.values;
    } else if (Array.isArray(options.values)) {
        for (const value of options.values) {
            p.innerHTML += value + '<br>'
        }
    }

    return p;
}

function addInput(element: Element, options: IInputOptions) {
    const container = document.createElement('div');
    container.classList.add(...options.classes);

    const label = document.createElement('label');
    label.htmlFor = options.label + options.uuid;
    label.innerText = options.labelName;

    const input = document.createElement('input');
    input.type = options.type;
    input.id = options.label + options.uuid;

    container.appendChild(label);
    container.appendChild(input);
    element.appendChild(container);

    return input;
}

function addSelect(element: Element, options: ISelectOptions) {
    const container = document.createElement('div');
    container.classList.add(...options.classes);

    const label = document.createElement('label');
    label.htmlFor = options.label + options.uuid;
    label.innerText = options.labelName;

    const select = document.createElement('select');
    select.id = options.label + options.uuid;
    if (options.multiple) {
        select.multiple = options.multiple
    }

    if (options.mainOption) {
        const mainOption = document.createElement('option');
        mainOption.innerText = options.mainOption;
        mainOption.disabled = true;
        select.appendChild(mainOption);
    }

    container.appendChild(label);
    container.appendChild(select);
    element.appendChild(container);

    return select;
}

async function addSelectSql(element: Element, options: ISelectOptions) {
    const select = addSelect(element, options);

    const result = await query(options.query!.url, options.query!.method, options.query!.body, options.query!.query);

    const rows: IRow[] = await result.json();
    for (const row of rows) {
        const option = document.createElement('option');
        option.innerText = row.value;
        option.value = row.id;
        select.appendChild(option);
        if (typeof options.values === 'string') {
            if (row.id === options.values) {
                select.value = row.id;
            }
        } else if (Array.isArray(options.values)) {
            if (options.values!.includes(row.id)) {
                option.selected = true;
            }
        }
    }

    return select;
}

async function addItems(li: Element, listCont: Element, entryIds: string[] | undefined) {
    if (entryIds && entryIds.length > 0) {
        let result: Response | any;
        let row: IEntry[];
        for (const entryId of entryIds) {
            result = await query('entry', 'GET', undefined, {id: entryId})
            row = await result.json();
            result = await query('procedure', 'GET', undefined, {id: row[0].procedure});
            result = await result.json();
            row[0].procedure = result[0].value;
            row[0].hardness = result[0].hardness;

            addItem(li, listCont, row[0]);
        }
    }
}

function validateHardness(card: Element) {
    return +card.getAttribute('total-hardness')! < 20;
}

function addItem(card: Element, listCont: Element, options?: IItemOptions) {
    const listItem = document.createElement('div');
    listItem.classList.add('list-item');
    listItem.setAttribute('edited', 'false');
    if (!options) {
        listItem.classList.add('editable');
    } else {
        listItem.id = options.id;
        listItem.setAttribute('hardness', options?.hardness);
    }

    const id = options ? options.id : crypto.randomUUID();
    const itemId = listItem.appendChild(document.createElement('div'));
    itemId.classList.add('item-id');
    itemId.innerHTML = `<p class="title">ID: ${id}</p>`;

    const itemFio = listItem.appendChild(document.createElement('div'));
    itemFio.classList.add('item-name');
    itemFio.innerHTML = '<p class="title">ФИО:</p>';

    const itemFioInput = addInput(itemFio, {
        uuid: id,
        classes: ['inp'],
        label: 'fio',
        labelName: '',
        type: 'text'
    });
    itemFioInput.addEventListener('change', () => {
        listItem.setAttribute('edited', 'true');
    });

    const itemFioP = itemFio.appendChild(document.createElement('p'));
    if (options && options.fio) {
        itemFioP.innerText = options.fio;
        itemFioInput.value = options.fio;
    }
    itemFioP.setAttribute('value', itemFioInput.value);

    const itemProcedure = listItem.appendChild(document.createElement('div'));
    itemProcedure.classList.add('item-type');
    itemProcedure.innerHTML = '<p class="title">Процедура:</p>';

    const itemProcedureSelect = addSelect(itemProcedure, {
        uuid: id,
        classes: ['inp'],
        label: 'type',
        labelName: ''
    });
    itemProcedureSelect.addEventListener('change', () => {
        listItem.setAttribute('edited', 'true');
    });
    Array.from((card.querySelector('.card-procedures select')! as HTMLSelectElement).selectedOptions)
        .forEach(option => {
            const newOption = document.createElement('option');
            newOption.value = option.value;
            newOption.innerText = option.innerText;
            itemProcedureSelect.appendChild(newOption);
            if (options && newOption.innerText === options.procedure) {
                newOption.selected = true;
            }
        });

    const itemProcedureP = itemProcedure.appendChild(document.createElement('p'));
    if (options && options.procedure) {
        itemProcedureP.innerText = options.procedure;
    }
    itemProcedureP.setAttribute('value', itemProcedureSelect.value);

    const itemButtons = listItem.appendChild(document.createElement('div'));
    itemButtons.classList.add('item-buttons');

    const buttonEdit = itemButtons.appendChild(document.createElement('img')) as HTMLImageElement;
    buttonEdit.src = "../assets/edit.svg";
    buttonEdit.alt = "Edit";
    buttonEdit.addEventListener('click', () => {
        itemFioInput.value = itemFioP.getAttribute('value')!;
        itemProcedureSelect.value = itemProcedureP.getAttribute('value')!;

        listItem.classList.add('editable');

        buttonEdit.classList.toggle('hidden');
        buttonDelete.classList.toggle('hidden');
        buttonApprove.classList.toggle('hidden');
        buttonCancel.classList.toggle('hidden');
    });

    const buttonDelete = itemButtons.appendChild(document.createElement('img'));
    buttonDelete.src = "../assets/delete-button.svg";
    buttonDelete.alt = "Delete";
    buttonDelete.addEventListener('click', async () => {
        const uuid = listItem.parentElement!.parentElement!.parentElement!.id;
        await query('shift', 'POST', {
            itemId: id,
            remove: true,
            entry: {
                remove: true
            }
        }, {
            id: uuid,
            entryId: id
        });

        const card = listItem.parentElement!.parentElement!.parentElement!;
        card.setAttribute('total-hardness', (+card.getAttribute('total-hardness')! - +listItem.getAttribute('hardness')!).toString());
        (card.querySelector('.total-hardness')! as HTMLElement).innerText = card.getAttribute('total-hardness')!;

        listItem.remove();
    });

    const buttonApprove = itemButtons.appendChild(document.createElement('img'));
    buttonApprove.src = "../assets/confirm.svg";
    buttonApprove.alt = "Approve";
    buttonApprove.addEventListener('click', async () => {
        if (!validateString(itemFioInput.value)) {
            alert('Следует заполнить все поля');
            return;
        }

        if (!validateHardness(card)) {
            alert('Превышена суммарная сложность смены.');
            return;
        }

        const result = await query('procedure', 'GET', undefined, {id: itemProcedureSelect.value});
        const newHardness = +(await result.json())[0].hardness;
        if (listItem.getAttribute('edited') === 'true') {
            const uuid = listCont.parentElement!.parentElement!.id;

            if (listItem.id) {
                await query('entry', 'POST', {
                    name: itemFioInput.value,
                    procedure: itemProcedureSelect.value
                }, {
                    id: id,
                });
                card.setAttribute('total-hardness', (+card.getAttribute('total-hardness')! + newHardness - +listItem.getAttribute('hardness')!).toString());
            } else {
                await query('shift', 'POST', {
                    itemId: id,
                    entry: {
                        id: id,
                        fio: itemFioInput.value,
                        procedure: itemProcedureSelect.value
                    }
                }, {
                    id: uuid,
                    entryId: id
                });


                card.setAttribute('total-hardness', (+card.getAttribute('total-hardness')! + newHardness).toString());
            }

            itemFioP.innerText = itemFioInput.value;
            itemProcedureP.innerText = itemProcedureSelect.options[itemProcedureSelect.selectedIndex].text;

            itemFioP.setAttribute('value', itemFioInput.value);
            itemProcedureP.setAttribute('value', itemProcedureSelect.value);

            listItem.id = id;
            enableDragAndDropListItem(listItem);
        }

        listItem.classList.remove('editable');
        listItem.setAttribute('edited', 'false');

        (card.querySelector('.total-hardness')! as HTMLElement).innerText = card.getAttribute('total-hardness')!;
        listItem.setAttribute('hardness', newHardness.toString());

        buttonEdit.classList.toggle('hidden');
        buttonDelete.classList.toggle('hidden');
        buttonApprove.classList.toggle('hidden');
        buttonCancel.classList.toggle('hidden');
    });

    const buttonCancel = itemButtons.appendChild(document.createElement('img')) as HTMLImageElement;
    buttonCancel.src = "../assets/delete.svg";
    buttonCancel.alt = "Cancel";
    buttonCancel.addEventListener('click', () => {
        if (listItem.id) {
            listItem.classList.remove('editable');

            itemFioInput.value = itemFioP.getAttribute('value')!;
            itemProcedureSelect.value = itemProcedureP.getAttribute('value')!;


            buttonEdit.classList.toggle('hidden');
            buttonDelete.classList.toggle('hidden');
            buttonApprove.classList.toggle('hidden');
            buttonCancel.classList.toggle('hidden');
        } else {
            listItem.remove();
        }
    });

    if (options) {
        buttonApprove.classList.add('hidden');
        buttonCancel.classList.add('hidden');
        card.setAttribute('total-hardness', (+card.getAttribute('total-hardness')! + +listItem.getAttribute('hardness')!).toString());
    } else {
        buttonEdit.classList.add('hidden');
        buttonDelete.classList.add('hidden');
    }

    listCont.appendChild(listItem);
}

async function createListElement(options: ICard) {
    const list = document.querySelector('.cards-list');

    const li = document.createElement('li');
    li.classList.add('card');
    li.id = options.id
    li.setAttribute('total-hardness', '0');

    const id = document.createElement('div');
    id.innerText = `ID: ${options.id}`;
    li.appendChild(id);

    const mainInfo = document.createElement('div');
    mainInfo.classList.add('main-info');

    let p = mainInfo.appendChild(document.createElement('p'));
    p.innerText = 'Основная информация';

    const buttonsMain = document.createElement('div');
    buttonsMain.classList.add('buttons');

    const buttonEdit = buttonsMain.appendChild(document.createElement('img'));
    buttonEdit.src = '../assets/edit.svg';
    buttonEdit.alt = 'edit';
    buttonEdit.addEventListener('click', () => {
        info.classList.toggle('editable');

        buttonEdit.classList.toggle('hidden');
        buttonApprove.classList.toggle('hidden');
        buttonCancel.classList.toggle('hidden');
    });

    const buttonApprove = buttonsMain.appendChild(document.createElement('img'));
    buttonApprove.src = '../assets/confirm.svg';
    buttonApprove.alt = 'edit';
    buttonApprove.classList.add('hidden');
    buttonApprove.addEventListener('click', async () => {
        if (info.getAttribute('edited') === 'true') {
            if (dateInput.value === '') {
                alert('Дата должна быть заполнена');
                return;
            }
            const procedures: string[] = [];
            Array.from(proceduresSelect.selectedOptions).forEach(option => procedures.push(option.value));
            const items = li.querySelectorAll('.list-item .item-type p:not(.title)');
            for (const item of items) {
                if (!procedures.includes(item.getAttribute('value')!)) {
                    alert('Невозможно изменить, так как присутствуют приемы с удаляемыми процедурами');
                    return;
                }
            }
            await query('shift', 'POST', {
                date: dateInput.value,
                procedures: procedures.map(procedure => `'${procedure}'`).join(', ')
            }, {
                id: options.id
            });

            dateP.innerText = dateInput.value;
            proceduresP.innerHTML = '';
            Array.from(proceduresSelect.selectedOptions).forEach(option => proceduresP.innerHTML += option.innerText + '<br>');

            dateP.setAttribute('value', dateInput.value);
            proceduresP.setAttribute('value', proceduresSelect.value);
        }

        info.setAttribute('edited', 'false');
        info.classList.toggle('editable');

        buttonEdit.classList.toggle('hidden');
        buttonApprove.classList.toggle('hidden');
        buttonCancel.classList.toggle('hidden');
    })

    const buttonCancel = buttonsMain.appendChild(document.createElement('img'));
    buttonCancel.src = '../assets/delete.svg';
    buttonCancel.alt = 'edit';
    buttonCancel.classList.add('hidden');
    buttonCancel.addEventListener('click', () => {
        info.classList.toggle('editable');

        if (info.getAttribute('edited') === 'true') {
            dateInput.value = dateP.getAttribute('value')!;
            const procedures = proceduresP.getAttribute('value')!.split(',');
            Array.from(proceduresSelect.options).forEach(option => {
                option.selected = procedures.includes(option.value);
            });
        }

        buttonEdit.classList.toggle('hidden');
        buttonApprove.classList.toggle('hidden');
        buttonCancel.classList.toggle('hidden');
    });
    mainInfo.appendChild(buttonsMain);

    li.appendChild(mainInfo);

    const info = document.createElement('div');
    info.classList.add('info');
    info.setAttribute('edited', 'false');

    const date = document.createElement('div');
    const dateP = addRow(date, {
        name: 'Дата',
        values: options.date.slice(0, 10),
        className: 'card-date'
    });
    const dateInput = addInput(date, {
        uuid: options.id,
        classes: ['inp'],
        label: 'date',
        labelName: '',
        type: 'date'
    });
    dateInput.value = options.date.slice(0, 10);
    dateP.setAttribute('value', dateInput.value);
    dateInput.addEventListener('change', () => {
        info.setAttribute('edited', 'true');
    })
    info.appendChild(date);

    const procedures = document.createElement('div');
    const proceduresP = addRow(procedures, {
        name: 'Процедуры',
        className: 'card-procedures'
    });
    const proceduresSelect = await addSelectSql(procedures!, {
        uuid: options.id,
        classes: ['inp'],
        label: 'procedures',
        labelName: '',
        multiple: true,
        query: {
            url: '/procedure',
            method: 'GET'
        },
        values: options.procedures
    });
    const proceduresTextArray: string[] = [];
    Array.from(proceduresSelect.selectedOptions).forEach(option => {
        proceduresTextArray.push(option.text);
    });
    proceduresTextArray.forEach(text => {
        proceduresP.innerHTML += text + '<br>';
    })
    proceduresP.setAttribute('value', options.procedures.join(','));
    proceduresSelect.addEventListener('change', () => {
        info.setAttribute('edited', 'true');
    })

    info.appendChild(procedures);

    const maxHardness = document.createElement('div');

    p = maxHardness.appendChild(document.createElement('p'));
    p.classList.add('title');
    p.innerText = 'Максимальная сложность смены';

    p = maxHardness.appendChild(document.createElement('p'));
    p.innerText = '20';

    info.appendChild(maxHardness);

    const totalHardness = document.createElement('div');

    p = totalHardness.appendChild(document.createElement('p'));
    p.classList.add('title');
    p.innerText = 'Общая сложность смены';

    p = totalHardness.appendChild(document.createElement('p'));
    p.classList.add('total-hardness');

    info.appendChild(totalHardness);

    li.appendChild(info);

    const cardList = li.appendChild(document.createElement('div'));
    cardList.classList.add('card-list');

    const cardListP = cardList.appendChild(document.createElement('p'));
    cardListP.innerHTML = 'Список приемов:';

    const listCont = cardList.appendChild(document.createElement('div'));
    listCont.classList.add('list-cont');

    const addBtn = li.appendChild(document.createElement('button'));
    addBtn.classList.add('add-card-btn');
    addBtn.innerText = 'Добавить прием';
    addBtn.addEventListener('click', () => {
        addItem(li, listCont);
    });

    const deleteBtn = li.appendChild(document.createElement('button'));
    deleteBtn.classList.add('delete-card-btn');
    deleteBtn.innerText = 'Удалить карточку';
    deleteBtn.addEventListener('click', async () => {
        await query('shift', 'DELETE', undefined, {id: li.id});

        li.remove();
    });

    await addItems(li, listCont, options.entries);

    (li.querySelector('.total-hardness')! as HTMLElement).innerText = li.getAttribute('total-hardness')!;

    list!.insertBefore(li, list!.lastElementChild);

    return li;
}

async function addListElement() {
    const modal = document.querySelector('.modal');
    if (modal) {
        const content = modal.querySelector('.content');

        const dateInput = addInput(content!, {
            classes: ['title'],
            label: 'city',
            labelName: 'Место назначения',
            type: 'date'
        });

        const proceduresSelect = await addSelectSql(content!, {
            classes: ['title'],
            label: 'procedures',
            labelName: 'Процедуры',
            mainOption: 'Название',
            multiple: true,
            query: {
                url: '/procedure',
                method: 'GET'
            },
        });

        async function createNewListElement() {
            const uuid = crypto.randomUUID();

            const procedures: string[] = [];
            Array.from(proceduresSelect.selectedOptions).forEach((option) => {
                procedures.push(option.value);
            })
            if (dateInput.value === '') {
                alert('Дата должна быть заполнена');
                return false;
            }
            await query('/shift', 'PUT', {
                id: uuid,
                date: dateInput.value,
                procedures: procedures.map(procedure => `'${procedure}'`).join(', '),
            });

            const li = await createListElement({
                id: uuid,
                date: dateInput.value,
                procedures: procedures,
                entries: []
            })

            enableDragAndDropCard(li)
            return true;
        }

        const modalButtons = modal.querySelector('.modal-buttons');

        const approveBtn = document.createElement('img');
        approveBtn.src = '../assets/confirm.svg';
        approveBtn.alt = 'Approve';
        approveBtn.id = 'approve';
        approveBtn.addEventListener('click', async () => {
            try {
                if (await createNewListElement())
                    toggleModal();
            } catch (e: any) {
                window.alert(e.message);
            }
        });
        modalButtons!.insertBefore(approveBtn, modalButtons!.firstChild);

        toggleModal();
    }
}

function enableDragAndDropCard(card: HTMLElement) {
    card.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        card.classList.add('drag-over');
    });

    card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
    });

    card.addEventListener('drop', async (e: DragEvent) => {
        e.preventDefault();
        card.classList.remove('drag-over');

        const data = e.dataTransfer?.getData('text/plain');
        if (!data) return;

        const {itemId} = JSON.parse(data);
        const item = document.getElementById(itemId)!;
        const draggedItem = document.getElementById(itemId)!;
        const targetList = card.querySelector<HTMLElement>('.list-cont')!;

        const cardId = card.id;

        if (!cardId) return;

        if (!validateHardness(card)) {
            alert('Превышена суммарная сложность смены.');
            return;
        }
        const proceduresTextArray: string[] = [];
        Array.from((card.querySelector('.card-procedures .inp select')! as HTMLSelectElement).selectedOptions).forEach(option => {
            proceduresTextArray.push(option.value);
        });

        if (!proceduresTextArray.includes(item.querySelector('.item-type p:not(.title)')!.getAttribute('value')!)) {
            alert('Невозможно добавить данную процедуру в смену.');
            return;
        }

        if (!targetList.querySelector('.list-item')) {
            const placeholder = document.createElement('div');
            placeholder.classList.add('list-item-placeholder');
            targetList.appendChild(placeholder);
        }

        const sourceCard = draggedItem.closest('.card');
        const sourceCardId = sourceCard?.id;
        if (sourceCardId) {
            await query('/shift', 'POST', {
                itemId,
                remove: true
            }, {
                id: sourceCardId
            });
        }

        await query('/shift', 'POST', {
            itemId,
        }, {
            id: cardId
        });

        targetList.appendChild(draggedItem);

        const placeholder = targetList.querySelector('.list-item-placeholder');
        if (placeholder) placeholder.remove();

        sourceCard!.setAttribute('total-hardness', (+sourceCard!.getAttribute('total-hardness')! - +item.getAttribute('hardness')!).toString());
        card!.setAttribute('total-hardness', (+card!.getAttribute('total-hardness')! + +item.getAttribute('hardness')!).toString());
        (card.querySelector('.total-hardness')! as HTMLElement).innerText = card.getAttribute('total-hardness')!;
        (sourceCard!.querySelector('.total-hardness')! as HTMLElement).innerText = sourceCard!.getAttribute('total-hardness')!;
    });
}

function enableDragAndDropListItem(item: HTMLElement) {
    item.draggable = true;
    item.addEventListener('dragstart', (e: DragEvent) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', JSON.stringify({
                itemId: item.id
            }));
        }
        item.classList.add('dragging');
    });

    item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
    });
}

function enableDragAndDrop() {
    const listItems = document.querySelectorAll<HTMLElement>('.list-item');
    listItems.forEach(enableDragAndDropListItem);

    const cards = document.querySelectorAll<HTMLElement>('.card');
    cards.forEach(enableDragAndDropCard);
}

async function createProcedure() {
    const modal = document.querySelector('.modal');
    if (modal) {
        const content = modal.querySelector('.content');

        const id = crypto.randomUUID();
        const idCont = document.createElement('div');
        idCont.innerHTML = `<p>ID: ${id}</p>`;
        content!.appendChild(idCont);

        const nameCont = document.createElement('div');
        const nameInput = addInput(nameCont, {
            classes: [],
            label: 'name',
            labelName: 'Название',
            type: 'text'
        });
        content!.appendChild(nameCont);

        const hardnessCont = document.createElement('div');
        const hardnessInput = addInput(nameCont, {
            classes: [],
            label: 'name',
            labelName: 'Сложность',
            type: 'number'
        });
        content!.appendChild(hardnessCont);

        const modalButtons = modal.querySelector('.modal-buttons');
        const approveBtn = document.createElement('img');
        approveBtn.src = '../assets/confirm.svg';
        approveBtn.alt = 'Approve';
        approveBtn.id = 'approve';
        approveBtn.addEventListener('click', async () => {
            if (!validateString(nameInput.value)) {
                alert(`Не заполнено поле ${nameInput.labels![0].innerText}`)
                return;
            }
            await query('procedure', 'PUT', {
                id: id,
                value: nameInput.value,
                hardness: hardnessInput.value
            });

            const proceduresSelects = document.querySelectorAll(`[id^='procedure']:not(.modal div)`);
            proceduresSelects.forEach(citySelect => {
                const option = document.createElement('option');
                option.value = id;
                option.innerText = nameInput.value;

                citySelect.appendChild(option);
            });

            toggleModal();
        });
        modalButtons!.insertBefore(approveBtn, modalButtons!.firstChild);

        toggleModal();
    }
}

async function init() {
    const result = await query('shift', 'GET');
    const rows: ICard[] = await result.json();
    for (const row of rows) {
        row.date = (new Date((new Date(row.date)).getTime() + 3 * 60 * 60 * 1000)).toISOString();
        await createListElement(row);
    }

    enableDragAndDrop();
}
