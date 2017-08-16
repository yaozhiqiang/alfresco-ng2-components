/*!
 * @license
 * Copyright 2016 Alfresco Software, Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    AfterContentInit, Component, ContentChild, ElementRef, EventEmitter, HostListener, Input, NgZone,
    OnChanges, OnInit, Output, SimpleChanges, TemplateRef, ViewChild
} from '@angular/core';
import { MinimalNodeEntity, MinimalNodeEntryEntity, NodePaging, Pagination, PersonEntry } from 'alfresco-js-api';
import { AlfrescoApiService, DataColumnListComponent } from 'ng2-alfresco-core';
import { DataCellEvent, DataColumn, DataRowActionEvent, DataSorting, DataTableComponent, ObjectDataColumn } from 'ng2-alfresco-datatable';
import { Observable, Subject } from 'rxjs/Rx';
import { ImageResolver, RowFilter, ShareDataRow, ShareDataTableAdapter } from './../data/share-datatable-adapter';
import { ContentActionModel } from './../models/content-action.model';
import { PermissionStyleModel } from './../models/permissions-style.model';
import { DocumentListService } from './../services/document-list.service';
import { NodeEntityEvent, NodeEntryEvent } from './node.event';

declare var require: any;

@Component({
    selector: 'adf-document-list, alfresco-document-list',
    styleUrls: ['./document-list.component.css'],
    templateUrl: './document-list.component.html'
})
export class DocumentListComponent implements OnInit, OnChanges, AfterContentInit {

    static SINGLE_CLICK_NAVIGATION: string = 'click';
    static DOUBLE_CLICK_NAVIGATION: string = 'dblclick';
    static DEFAULT_PAGE_SIZE: number = 20;

    @ContentChild(DataColumnListComponent) columnList: DataColumnListComponent;

    @Input()
    permissionsStyle: PermissionStyleModel[] = [];

    @Input()
    navigate: boolean = true;

    @Input()
    navigationMode: string = DocumentListComponent.DOUBLE_CLICK_NAVIGATION; // click|dblclick

    @Input()
    thumbnails: boolean = false;

    @Input()
    selectionMode: string = 'single'; // null|single|multiple

    @Input()
    multiselect: boolean = false;

    @Input()
    enablePagination: boolean = true;

    @Input()
    contentActions: boolean = false;

    @Input()
    contentActionsPosition: string = 'right'; // left|right

    @Input()
    contextMenuActions: boolean = false;

    @Input()
    pageSize: number = DocumentListComponent.DEFAULT_PAGE_SIZE;

    @Input()
    emptyFolderImageUrl: string = require('../assets/images/empty_doc_lib.svg');

    @Input()
    allowDropFiles: boolean = false;

    @Input()
    sorting: string[];

    @Input()
    rowStyle: string;

    @Input()
    rowStyleClass: string;

    @Input()
    loading: boolean = false;

    selection = new Array<MinimalNodeEntity>();
    skipCount: number = 0;
    pagination: Pagination;

    @Input()
    rowFilter: RowFilter|null = null;

    @Input()
    imageResolver: ImageResolver|null = null;

    // The identifier of a node. You can also use one of these well-known aliases: -my- | -shared- | -root-
    @Input()
    currentFolderId: string = null;

    @Input()
    folderNode: MinimalNodeEntryEntity = null;

    @Input()
    node: NodePaging = null;

    @Output()
    nodeClick: EventEmitter<NodeEntityEvent> = new EventEmitter<NodeEntityEvent>();

    @Output()
    nodeDblClick: EventEmitter<NodeEntityEvent> = new EventEmitter<NodeEntityEvent>();

    @Output()
    folderChange: EventEmitter<NodeEntryEvent> = new EventEmitter<NodeEntryEvent>();

    @Output()
    preview: EventEmitter<NodeEntityEvent> = new EventEmitter<NodeEntityEvent>();

    @Output()
    ready: EventEmitter<any> = new EventEmitter();

    @Output()
    error: EventEmitter<any> = new EventEmitter();

    @ViewChild(DataTableComponent)
    dataTable: DataTableComponent;

    errorMessage;
    actions: ContentActionModel[] = [];
    emptyFolderTemplate: TemplateRef<any>;
    contextActionHandler: Subject<any> = new Subject();
    data: ShareDataTableAdapter;

    private currentNodeAllowableOperations: string[] = [];
    private CREATE_PERMISSION = 'create';

    constructor(private documentListService: DocumentListService,
                private ngZone: NgZone,
                private elementRef: ElementRef,
                private apiService: AlfrescoApiService) {
    }

    private get nodesApi() {
        return this.apiService.getInstance().core.nodesApi;
    }

    private get sharedLinksApi() {
        return this.apiService.getInstance().core.sharedlinksApi;
    }

    private get sitesApi() {
        return this.apiService.getInstance().core.sitesApi;
    }

    private get favoritesApi() {
        return this.apiService.getInstance().core.favoritesApi;
    }

    private get peopleApi() {
        return this.apiService.getInstance().core.peopleApi;
    }

    private get searchApi() {
        return this.apiService.getInstance().search.searchApi;
    }

    getContextActions(node: MinimalNodeEntity) {
        if (node && node.entry) {
            let actions = this.getNodeActions(node);
            if (actions && actions.length > 0) {
                return actions.map(a => {
                    return {
                        model: a,
                        node: node,
                        subject: this.contextActionHandler
                    };
                });
            }
        }
        return null;
    }

    contextActionCallback(action) {
        if (action) {
            this.executeContentAction(action.node, action.model);
        }
    }

    ngOnInit() {
        this.data = new ShareDataTableAdapter(this.documentListService, null, this.getDefaultSorting());
        this.data.thumbnails = this.thumbnails;
        this.data.permissionsStyle = this.permissionsStyle;

        if (this.rowFilter) {
            this.data.setFilter(this.rowFilter);
        }

        if (this.imageResolver) {
            this.data.setImageResolver(this.imageResolver);
        }

        this.contextActionHandler.subscribe(val => this.contextActionCallback(val));

        this.enforceSingleClickNavigationForMobile();
    }

    ngAfterContentInit() {
        let schema: DataColumn[] = [];

        if (this.columnList && this.columnList.columns && this.columnList.columns.length > 0) {
            schema = this.columnList.columns.map(c => <DataColumn> c);
        }

        if (!this.data) {
            this.data = new ShareDataTableAdapter(this.documentListService, schema, this.getDefaultSorting());
        } else if (schema && schema.length > 0) {
            this.data.setColumns(schema);
        }

        let columns = this.data.getColumns();
        if (!columns || columns.length === 0) {
            this.setupDefaultColumns();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['folderNode'] && changes['folderNode'].currentValue) {
            this.loadFolder();
        } else if (changes['currentFolderId'] && changes['currentFolderId'].currentValue) {
            this.loadFolderByNodeId(changes['currentFolderId'].currentValue);
        } else if (this.data) {
            if (changes['node'] && changes['node'].currentValue) {
                this.data.loadPage(changes['node'].currentValue);
            } else if (changes['rowFilter']) {
                this.data.setFilter(changes['rowFilter'].currentValue);
                if (this.currentFolderId) {
                    this.loadFolderNodesByFolderNodeId(this.currentFolderId, this.pageSize, this.skipCount);
                }
            } else if (changes['imageResolver']) {
                this.data.setImageResolver(changes['imageResolver'].currentValue);
            }
        }
    }

    reload() {
        this.ngZone.run(() => {
            if (this.folderNode) {
                this.loadFolder();
            } else if (this.currentFolderId) {
                this.loadFolderByNodeId(this.currentFolderId);
            } else if (this.node) {
                this.data.loadPage(this.node);
                this.ready.emit();
            }
        });
    }

    isEmptyTemplateDefined(): boolean {
        if (this.dataTable) {
            if (this.emptyFolderTemplate) {
                return true;
            }
        }
        return false;
    }

    isMobile(): boolean {
        return !!/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    isEmpty() {
        return !this.data || this.data.getRows().length === 0;
    }

    isPaginationEnabled() {
        return this.enablePagination && !this.isEmpty();
    }

    getNodeActions(node: MinimalNodeEntity | any): ContentActionModel[] {
        let target = null;

        if (node && node.entry) {
            if (node.entry.isFile) {
                target = 'document';
            }

            if (node.entry.isFolder) {
                target = 'folder';
            }

            if (target) {
                let ltarget = target.toLowerCase();
                let actionsByTarget = this.actions.filter(entry => {
                    return entry.target.toLowerCase() === ltarget;
                }).map(action => new ContentActionModel(action));

                actionsByTarget.forEach((action) => {
                    this.checkPermission(node, action);
                });

                return actionsByTarget;
            }
        }

        return [];
    }

    checkPermission(node: any, action: ContentActionModel): ContentActionModel {
        if (action.permission) {
            if (this.hasPermissions(node)) {
                let permissions = node.entry.allowableOperations;
                let findPermission = permissions.find(permission => permission === action.permission);
                if (!findPermission && action.disableWithNoPermission === true) {
                    action.disabled = true;
                }
            }
        }
        return action;
    }

    private hasPermissions(node: any): boolean {
        return node.entry.allowableOperations ? true : false;
    }

    @HostListener('contextmenu', ['$event'])
    onShowContextMenu(e?: Event) {
        if (e && this.contextMenuActions) {
            e.preventDefault();
        }
    }

    performNavigation(node: MinimalNodeEntity): boolean {
        if (this.canNavigateFolder(node)) {
            this.currentFolderId = node.entry.id;
            this.folderNode = node.entry;
            this.skipCount = 0;
            this.currentNodeAllowableOperations = node.entry['allowableOperations'] ? node.entry['allowableOperations'] : [];
            this.loadFolder();
            this.folderChange.emit(new NodeEntryEvent(node.entry));
            return true;
        }
        return false;
    }

    /**
     * Invoked when executing content action for a document or folder.
     * @param node Node to be the context of the execution.
     * @param action Action to be executed against the context.
     */
    executeContentAction(node: MinimalNodeEntity, action: ContentActionModel) {
        if (node && node.entry && action) {
            let handlerSub;

            if (typeof action.handler === 'function') {
                handlerSub = action.handler(node, this, action.permission);
            } else {
                handlerSub = Observable.of(true);
            }

            if (typeof action.execute === 'function') {
                handlerSub.subscribe(() => { action.execute(node); });
            }
        }
    }

    loadFolder() {
        this.loading = true;
        let nodeId = this.folderNode ? this.folderNode.id : this.currentFolderId;
        if (nodeId) {
            this.loadFolderNodesByFolderNodeId(nodeId, this.pageSize, this.skipCount).catch(err => this.error.emit(err));
        }
    }

    // gets folder node and its content
    loadFolderByNodeId(nodeId: string) {
        this.loading = true;

        if (nodeId === '-trashcan-') {
            this.loadTrashcan();
        } else if (nodeId === '-sharedlinks-') {
            this.loadSharedLinks();
        } else if (nodeId === '-sites-') {
            this.loadSites();
        } else if (nodeId === '-favorites-') {
            this.loadFavorites();
        } else if (nodeId === '-recent-') {
            this.loadRecent();
        } else {
            this.documentListService
                .getFolderNode(nodeId).then(node => {
                    this.folderNode = node;
                    this.currentFolderId = node.id;
                    this.skipCount = 0;
                    this.currentNodeAllowableOperations = node['allowableOperations'] ? node['allowableOperations'] : [];
                    this.loadFolderNodesByFolderNodeId(node.id, this.pageSize, this.skipCount).catch(err => this.error.emit(err));
                })
                .catch(err => this.error.emit(err));
        }
    }

    loadFolderNodesByFolderNodeId(id: string, maxItems: number, skipCount: number): Promise<any> {
        return new Promise((resolve, reject) => {
            this.documentListService
                .getFolder(null, {
                    maxItems: maxItems,
                    skipCount: skipCount,
                    rootFolderId: id
                })
                .subscribe(
                    val => {
                        if (this.isCurrentPageEmpty(val, skipCount)) {
                            this.updateSkipCount(skipCount - maxItems);
                            this.loadFolderNodesByFolderNodeId(id, maxItems, skipCount - maxItems).then(
                                () => resolve(true),
                                error => reject(error)
                            );
                        } else {
                            this.data.loadPage(<NodePaging> val);
                            this.pagination = val.list.pagination;
                            this.loading = false;
                            this.ready.emit();
                            resolve(true);
                        }
                    },
                    error => {
                        reject(error);
                    });
        });

    }

    private loadTrashcan(): void {
        const options = {
            include: [ 'path', 'properties' ],
            maxItems: this.pageSize,
            skipCount: this.skipCount
        };
        this.nodesApi.getDeletedNodes(options).then((page: NodePaging) => {
            this.onPageLoaded(page);
        });
    }

    private loadSharedLinks(): void {
        const options = {
            include: [ 'properties', 'allowableOperations', 'path' ],
            maxItems: this.pageSize,
            skipCount: this.skipCount
        };
        this.sharedLinksApi.findSharedLinks(options).then((page: NodePaging) => {
           this.onPageLoaded(page);
        });
    }

    private loadSites(): void {
        const options = {
            include: [ 'properties' ],
            maxItems: this.pageSize,
            skipCount: this.skipCount
        };

        this.sitesApi.getSites(options).then((page: NodePaging) => {
            this.onPageLoaded(page);
        });
    }

    private loadFavorites(): void {
        const options = {
            maxItems: this.pageSize,
            skipCount: this.skipCount,
            where: '(EXISTS(target/file) OR EXISTS(target/folder))',
            include: [ 'properties', 'allowableOperations', 'path' ]
        };

        this.favoritesApi.getFavorites('-me-', options).then((result: NodePaging) => {
            let page: NodePaging = {
                list: {
                    entries: result.list.entries
                        .map(({ entry: { target }}: any) => ({
                            entry: target.file || target.folder
                        }))
                        .map(({ entry }: any) => {
                            entry.properties = {
                                'cm:title': entry.title,
                                'cm:description': entry.description
                            };
                            return { entry };
                        }),
                    pagination: result.list.pagination
                }
            };
            this.onPageLoaded(page);
        });
    }

    private loadRecent(): void {
        this.peopleApi.getPerson('-me-').then((person: PersonEntry) => {
            const username = person.entry.id;
            const query = {
                query: {
                    query: '*',
                    language: 'afts'
                },
                filterQueries: [
                    { query: `cm:modified:[NOW/DAY-30DAYS TO NOW/DAY+1DAY]` },
                    { query: `cm:modifier:${username} OR cm:creator:${username}` },
                    { query: `TYPE:"content" AND -TYPE:"app:filelink" AND -TYPE:"fm:post"` }
                ],
                include: [ 'path', 'properties', 'allowableOperations' ],
                sort: [{
                    type: 'FIELD',
                    field: 'cm:modified',
                    ascending: false
                }],
                paging: {
                    maxItems: this.pageSize,
                    skipCount: this.skipCount
                }
            };

            this.searchApi.search(query).then(page => this.onPageLoaded(page));
        });
    }

    private onPageLoaded(page: NodePaging) {
        this.data.loadPage(page);
        this.pagination = page.list.pagination;
        this.loading = false;
        this.ready.emit();
    }

    private isCurrentPageEmpty(node, skipCount): boolean {
        return !this.hasNodeEntries(node) && this.hasPages(skipCount);
    }

    private hasPages(skipCount): boolean {
        return skipCount > 0 && this.isPaginationEnabled();
    }

    private hasNodeEntries(node): boolean {
        return node && node.list && node.list.entries && node.list.entries.length > 0;
    }

    /**
     * Creates a set of predefined columns.
     */
    setupDefaultColumns(): void {
        let colThumbnail = new ObjectDataColumn({
            type: 'image',
            key: '$thumbnail',
            title: '',
            srTitle: 'Thumbnail'
        });

        let colName = new ObjectDataColumn({
            type: 'text',
            key: 'name',
            title: 'Name',
            cssClass: 'full-width',
            sortable: true
        });

        this.data.setColumns([colThumbnail, colName]);
    }

    onPreviewFile(node: MinimalNodeEntity) {
        if (node) {
            this.preview.emit(new NodeEntityEvent(node));
        }
    }

    onNodeClick(node: MinimalNodeEntity) {
        const domEvent = new CustomEvent('node-click', {
            detail: {
                sender: this,
                node: node
            },
            bubbles: true
        });
        this.elementRef.nativeElement.dispatchEvent(domEvent);

        const event = new NodeEntityEvent(node);
        this.nodeClick.emit(event);

        if (!event.defaultPrevented) {
            if (this.navigate && this.navigationMode === DocumentListComponent.SINGLE_CLICK_NAVIGATION) {
                if (node && node.entry) {
                    if (node.entry.isFile) {
                        this.onPreviewFile(node);
                    }

                    if (node.entry.isFolder) {
                        this.performNavigation(node);
                    }
                }
            }
        }
    }

    onNodeDblClick(node: MinimalNodeEntity) {
        const domEvent = new CustomEvent('node-dblclick', {
            detail: {
                sender: this,
                node: node
            },
            bubbles: true
        });
        this.elementRef.nativeElement.dispatchEvent(domEvent);

        const event = new NodeEntityEvent(node);
        this.nodeDblClick.emit(event);

        if (!event.defaultPrevented) {
            if (this.navigate && this.navigationMode === DocumentListComponent.DOUBLE_CLICK_NAVIGATION) {
                if (node && node.entry) {
                    if (node.entry.isFile) {
                        this.onPreviewFile(node);
                    }

                    if (node.entry.isFolder) {
                        this.performNavigation(node);
                    }
                }
            }
        }
    }

    onNodeSelect(event: { row: ShareDataRow, selection: Array<ShareDataRow> }) {
        this.selection = event.selection.map(entry => entry.node);
        const domEvent = new CustomEvent('node-select', {
            detail: {
                node: event.row.node,
                selection: this.selection
            },
            bubbles: true
        });
        this.elementRef.nativeElement.dispatchEvent(domEvent);
    }

    onNodeUnselect(event: { row: ShareDataRow, selection: Array<ShareDataRow> }) {
        this.selection = event.selection.map(entry => entry.node);
        const domEvent = new CustomEvent('node-unselect', {
            detail: {
                node: event.row.node,
                selection: this.selection
            },
            bubbles: true
        });
        this.elementRef.nativeElement.dispatchEvent(domEvent);
    }

    onShowRowContextMenu(event: DataCellEvent) {
        if (this.contextMenuActions) {
            let args = event.value;
            let node = (<ShareDataRow> args.row).node;
            if (node) {
                args.actions = this.getContextActions(node) || [];
            }
        }
    }

    onShowRowActionsMenu(event: DataCellEvent) {
        if (this.contentActions) {
            let args = event.value;
            let node = (<ShareDataRow> args.row).node;
            if (node) {
                args.actions = this.getNodeActions(node) || [];
            }
        }
    }

    onExecuteRowAction(event: DataRowActionEvent) {
        if (this.contentActions) {
            let args = event.value;
            let node = (<ShareDataRow> args.row).node;
            let action = (<ContentActionModel> args.action);
            this.executeContentAction(node, action);
        }
    }

    onChangePageSize(event: Pagination): void {
        this.pageSize = event.maxItems;
        this.reload();
    }

    onNextPage(event: Pagination): void {
        this.skipCount = event.skipCount;
        this.reload();
    }

    onPrevPage(event: Pagination): void {
        this.skipCount = event.skipCount;
        this.reload();
    }

    private enforceSingleClickNavigationForMobile(): void {
        if (this.isMobile()) {
            this.navigationMode = DocumentListComponent.SINGLE_CLICK_NAVIGATION;
        }
    }

    private getDefaultSorting(): DataSorting {
        let defaultSorting: DataSorting;
        if (this.sorting) {
            const [key, direction] = this.sorting;
            defaultSorting = new DataSorting(key, direction);
        }
        return defaultSorting;
    }

    canNavigateFolder(node: MinimalNodeEntity): boolean {
        const restricted = ['-trashcan-', '-sharedlinks-', '-sites-', '-favorites-', '-recent-'];

        if (restricted.indexOf(this.currentFolderId) > -1) {
            return false;
        }

        if (node && node.entry && node.entry.isFolder) {
            return true;
        }

        return false;
    }

    updateSkipCount(newSkipCount) {
        this.skipCount = newSkipCount;
    }

    hasCurrentNodePermission(permission: string): boolean {
        let hasPermission: boolean = false;
        if (this.currentNodeAllowableOperations.length > 0) {
            let permFound = this.currentNodeAllowableOperations.find(element => element === permission);
            hasPermission = permFound ? true : false;
        }
        return hasPermission;
    }

    hasCreatePermission() {
        return this.hasCurrentNodePermission(this.CREATE_PERMISSION);
    }
}
